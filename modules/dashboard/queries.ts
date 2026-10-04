import { db } from "@/lib/db"
import { isOpenKind, isWonKind } from "@/lib/pipeline-stages"
import {
  brokerContactScope,
  brokerScopeFilter,
  type ViewerScope,
} from "@/lib/permissions"

/**
 * Dashboard aggregates.
 *
 * Kept out of the page so the four charts and the tables all read from one
 * shape, and so the (unavoidable) judgement calls below live in one file rather
 * than being scattered through JSX.
 *
 * Three deliberate simplifications, each one visible in the UI as an explicit
 * caveat rather than a silent wrong number:
 *
 *  - **"Won over time" buckets by `Deal.wonAt`.** Stamped once, at the moment a
 *    deal enters the Won stage, and cleared if it leaves. `updatedAt` was the
 *    old proxy and it was wrong in a way that made the trend unreadable: it
 *    moves on every edit, so editing a won deal moved its revenue into the
 *    current month, and every row written by a seed or an import landed in the
 *    month that import ran. `wonAt ?? updatedAt` keeps the fallback for deals
 *    closed before the column existed, where no honest date is recoverable.
 *  - **Month buckets are filled in JS, not SQL.** Postgres would need
 *    `generate_series`; a six-element array in memory is not worth a raw query
 *    and keeps the empty months visible, which is the point of a trend.
 *  - **Win probability is a value-weighted mean, not a plain average.** A plain
 *    average lets a ₹40L deal with no probability set dilute the number just as
 *    hard as a ₹4L one, which is not what "how likely is my pipeline" means.
 *  - **Money is summed in one currency only.** `Deal.currency` is per-deal and
 *    the schema has no workspace-level currency, so a workspace can legitimately
 *    hold CAD and INR deals at once. Adding those numbers together and printing
 *    one rupee total is not a rounding error, it is a fabricated number — there
 *    is no FX table anywhere in this codebase to convert with. So the money
 *    aggregates are scoped to a single reporting currency (see
 *    `reportingCurrency`) and anything held in another is counted and disclosed
 *    rather than silently folded in. Deal *counts* still count every deal,
 *    because a CAD deal is still a deal in Negotiation.
 */

const MONTHS = 6

export type PipelineStageRollup = {
  id: string
  name: string
  order: number
  count: number
  value: number
}

export type WonMonth = { month: string; label: string; value: number; count: number }

export type LeadSourceSlice = { source: string; count: number }

export type DashboardData = {
  counts: {
    contacts: number
    deals: number
    openDeals: number
    wonDeals: number
    projects: number
    units: number
    siteVisits: number
    tasks: number
  }
  /**
   * ISO code every money aggregate on this dashboard is denominated in.
   *
   * The UI has to pass this to `formatMoneyShort` rather than accepting the
   * default — a CAD workspace formatted with the INR default renders a rupee
   * sign over a Canadian dollar figure.
   */
  currency: string
  /** Deals held in a currency other than `currency`, excluded from the money aggregates. */
  foreignCurrencyDeals: number
  openPipeline: number
  weightedPipeline: number
  /** Value-weighted mean probability across open deals, 0–100. Null when nothing carries one. */
  winProbability: number | null
  stages: PipelineStageRollup[]
  wonByMonth: WonMonth[]
  leadSources: LeadSourceSlice[]
  topDeals: Awaited<ReturnType<typeof getTopDeals>>
  recentActivity: Awaited<ReturnType<typeof getRecentActivity>>
  projects: Awaited<ReturnType<typeof getRecentProjects>>
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function lastNMonthBuckets(n: number, now: Date): WonMonth[] {
  const buckets: WonMonth[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    buckets.push({ month: monthKey(d), label: MONTH_LABELS[d.getUTCMonth()], value: 0, count: 0 })
  }
  return buckets
}

/**
 * The single currency this workspace's money is reported in.
 *
 * There is no workspace-level currency to read, so it is derived from the deals
 * themselves: the currency most of them are denominated in. Ties break on total
 * value and then alphabetically, because a dashboard that renames its own
 * currency between two renders of the same data is worse than an arbitrary but
 * stable choice.
 *
 * `INR` is the floor rather than a preference — it is the schema default
 * (`Deal.currency @default("INR")`) and this is an India-first product, so a
 * workspace with no deals at all still formats as rupees instead of falling
 * through to a bare symbol.
 */
export function reportingCurrency(deals: { currency: string; value: number | null }[]) {
  const tally = new Map<string, { count: number; value: number }>()
  for (const deal of deals) {
    const currency = deal.currency || "INR"
    const slot = tally.get(currency) ?? { count: 0, value: 0 }
    slot.count += 1
    slot.value += deal.value ?? 0
    tally.set(currency, slot)
  }
  if (tally.size === 0) return "INR"
  return [...tally.entries()].sort(
    (a, b) => b[1].count - a[1].count || b[1].value - a[1].value || a[0].localeCompare(b[0]),
  )[0][0]
}

async function getTopDeals(scope: ViewerScope) {
  return db.deal.findMany({
    where: { workspaceId: scope.workspaceId, ...brokerScopeFilter(scope.role, scope.brokerId) },
    orderBy: [{ value: "desc" }, { updatedAt: "desc" }],
    take: 6,
    select: {
      id: true,
      title: true,
      value: true,
      currency: true,
      probability: true,
      stage: { select: { name: true, color: true } },
      owner: { select: { name: true } },
      organization: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
    },
  })
}

async function getRecentActivity(scope: ViewerScope) {
  return db.activity.findMany({
    where: {
      workspaceId: scope.workspaceId,
      // Activity rows are not broker-scoped directly, but a row that belongs to
      // another broker's deal carries that deal's title in `body`. Scoping
      // through the deal relation keeps the dashboard timeline from becoming a
      // second way to read a competitor's book. Rows with no deal are workspace
      // chatter and stay visible.
      ...(scope.role === "BROKER"
        ? { OR: [{ dealId: null }, { deal: { brokerId: scope.brokerId ?? "__no_broker__" } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 7,
    select: { id: true, type: true, body: true, createdAt: true },
  })
}

async function getRecentProjects(workspaceId: string) {
  return db.project.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 4,
    select: {
      id: true,
      name: true,
      city: true,
      reraNo: true,
      _count: { select: { units: true } },
    },
  })
}

export async function getDashboardData(scope: ViewerScope): Promise<DashboardData> {
  const now = new Date()
  const { workspaceId } = scope
  // Every deal- or contact-derived number below is a rollup over rows, so a
  // missing predicate here does not look wrong on screen — the dashboard simply
  // shows a broker the whole tenant's figures, which reads as a legitimate
  // total. Scoping is applied once here and spread into each deal/contact query
  // rather than per-call, so a new aggregate added later inherits it.
  const dealScope = brokerScopeFilter(scope.role, scope.brokerId)
  const contactScope = brokerContactScope(scope.role, scope.brokerId)

  const [contacts, deals, projects, siteVisits, tasks, stages, allDeals, leadGroups, topDeals, recentActivity, recentProjects, units] =
    await Promise.all([
      db.contact.count({ where: { workspaceId, ...contactScope } }),
      db.deal.count({ where: { workspaceId, ...dealScope } }),
      db.project.count({ where: { workspaceId } }),
      db.siteVisit.count({ where: { workspaceId } }),
      // Open tasks are `Activity` rows of type TASK with no completion stamp —
      // there is no separate Task model in this schema.
      db.activity.count({
        where: { workspaceId, type: "TASK", completedAt: null },
      }),
      db.pipelineStage.findMany({
        where: { workspaceId },
        orderBy: { order: "asc" },
        select: { id: true, name: true, order: true },
      }),
      // Every deal, but only the seven fields the charts need. `wonAt` (falling
      // back to `updatedAt`) is the won-time proxy; `probability`/`value` feed
      // the weighted mean; `currency` picks the reporting currency; `stage.kind`
      // decides whether a deal is still in play. A workspace with thousands of
      // deals should not ship thousands of rows to render six bar segments and
      // one donut, so the rollup happens in memory from a deliberately narrow
      // select.
      db.deal.findMany({
        where: { workspaceId, ...dealScope },
        select: {
          stageId: true,
          value: true,
          probability: true,
          updatedAt: true,
          wonAt: true,
          currency: true,
          stage: { select: { name: true, kind: true } },
        },
      }),
      db.contact.groupBy({
        by: ["leadSource"],
        where: { workspaceId, leadSource: { not: null }, ...contactScope },
        _count: { _all: true },
      }),
      getTopDeals(scope),
      getRecentActivity(scope),
      getRecentProjects(workspaceId),
      // A real count across every project. Summing `_count.units` over
      // `recentProjects` instead — which is `take: 4` — silently undercounts
      // any workspace with more than four projects, which is most of them.
      db.unit.count({ where: { workspaceId } }),
    ])

  const currency = reportingCurrency(allDeals)

  // ── Per-stage rollup ─────────────────────────────────────────────────────
  const byStage = new Map<string, { count: number; value: number }>()
  let openDeals = 0
  let wonDeals = 0
  let openPipeline = 0
  let foreignCurrencyDeals = 0
  let probabilityValue = 0
  let probabilityWeight = 0

  // ── Won-by-month accumulation, bucketed as we walk ────────────────────────
  const buckets = lastNMonthBuckets(MONTHS, now)
  const wonIndex = new Map(buckets.map((b, i) => [b.month, i]))

  for (const deal of allDeals) {
    // The one gate every money figure passes through. Counts below stay
    // unconditional; only sums and value-weights are currency-scoped.
    const inCurrency = (deal.currency || "INR") === currency

    const slot = byStage.get(deal.stageId) ?? { count: 0, value: 0 }
    slot.count += 1
    if (inCurrency) slot.value += deal.value ?? 0
    byStage.set(deal.stageId, slot)

    const kind = deal.stage.kind
    const isOpen = isOpenKind(kind)

    if (isOpen) {
      openDeals += 1
      if (!inCurrency) {
        foreignCurrencyDeals += 1
      } else {
        openPipeline += deal.value ?? 0
        if (deal.probability != null) {
          // Weight the mean by deal value, and skip zero-value deals entirely:
          // a deal with no value would otherwise pull the average toward zero
          // while carrying no information about it.
          if ((deal.value ?? 0) > 0) {
            probabilityValue += deal.probability * (deal.value ?? 0)
            probabilityWeight += deal.value ?? 0
          }
        }
      }
    } else if (isWonKind(kind)) {
      wonDeals += 1
      // `wonAt` when the transition recorded one, `updatedAt` only as the
      // fallback for deals closed before the column existed. Bucketing the
      // fallback into the same series is deliberate: those deals belong in
      // *some* month and `updatedAt` is the last moment they were known to be
      // in Won, which is the least-wrong answer available for them.
      const wonAt = deal.wonAt ?? deal.updatedAt
      const idx = wonIndex.get(monthKey(wonAt))
      if (idx != null) {
        // The count is every won deal touched in the month; the value is only
        // the reporting-currency ones. Both are labelled as such where they are
        // rendered, because a bucket with a count but no value is a real state
        // (wins in another currency) and not a rounding artifact.
        buckets[idx] = {
          ...buckets[idx],
          value: buckets[idx].value + (inCurrency ? deal.value ?? 0 : 0),
          count: buckets[idx].count + 1,
        }
      }
    }
  }

  // ── Lead sources, ranked, with a long tail folded into "Other" ───────────
  // A donut with fourteen 1%-slices is unreadable, and lead sources are an
  // open-text field in this schema, so the tail is real and has to be bounded.
  const LEAD_TAIL = 5
  const ranked = leadGroups
    .map((g) => ({ source: String(g.leadSource), count: g._count._all }))
    .sort((a, b) => b.count - a.count)
  const leadSources: LeadSourceSlice[] = ranked.slice(0, LEAD_TAIL)
  if (ranked.length > LEAD_TAIL) {
    leadSources.push({
      source: "Other",
      count: ranked.slice(LEAD_TAIL).reduce((sum, s) => sum + s.count, 0),
    })
  }

  return {
    counts: {
      contacts,
      deals,
      openDeals,
      wonDeals,
      projects,
      units,
      siteVisits,
      tasks,
    },
    currency,
    foreignCurrencyDeals,
    openPipeline,
    weightedPipeline: probabilityWeight > 0 ? probabilityValue / probabilityWeight : 0,
    winProbability: probabilityWeight > 0 ? Math.round(probabilityValue / probabilityWeight) : null,
    stages: stages.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      count: byStage.get(s.id)?.count ?? 0,
      value: byStage.get(s.id)?.value ?? 0,
    })),
    wonByMonth: buckets,
    leadSources,
    topDeals,
    recentActivity,
    projects: recentProjects,
  }
}
