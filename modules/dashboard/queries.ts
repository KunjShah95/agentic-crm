import { db } from "@/lib/db"

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
 *  - **"Won over time" buckets by `updatedAt`, not a `wonAt` column.** The
 *    schema has no won timestamp. Editing a closed deal pushes it into the
 *    current month, so the series is "recently touched in the Won stage",
 *    labelled as such on the chart. Inventing a `wonAt` here would need a
 *    migration and would still be wrong for deals closed before it existed.
 *  - **Month buckets are filled in JS, not SQL.** Postgres would need
 *    `generate_series`; a six-element array in memory is not worth a raw query
 *    and keeps the empty months visible, which is the point of a trend.
 *  - **Win probability is a value-weighted mean, not a plain average.** A plain
 *    average lets a ₹40L deal with no probability set dilute the number just as
 *    hard as a ₹4L one, which is not what "how likely is my pipeline" means.
 */

const WON = "Won"
const LOST = "Lost"
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

async function getTopDeals(workspaceId: string) {
  return db.deal.findMany({
    where: { workspaceId },
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

async function getRecentActivity(workspaceId: string) {
  return db.activity.findMany({
    where: { workspaceId },
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

export async function getDashboardData(workspaceId: string): Promise<DashboardData> {
  const now = new Date()

  const [contacts, deals, projects, siteVisits, tasks, stages, allDeals, leadGroups, topDeals, recentActivity, recentProjects] =
    await Promise.all([
      db.contact.count({ where: { workspaceId } }),
      db.deal.count({ where: { workspaceId } }),
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
      // Every deal, but only the four fields the charts need. `updatedAt` is
      // the won-time proxy; `probability`/`value` feed the weighted mean. A
      // workspace with thousands of deals should not ship thousands of rows to
      // render six bar segments and one donut, so the rollup happens in memory
      // from a deliberately narrow select.
      db.deal.findMany({
        where: { workspaceId },
        select: {
          stageId: true,
          value: true,
          probability: true,
          updatedAt: true,
          stage: { select: { name: true } },
        },
      }),
      db.contact.groupBy({
        by: ["leadSource"],
        where: { workspaceId, leadSource: { not: null } },
        _count: { _all: true },
      }),
      getTopDeals(workspaceId),
      getRecentActivity(workspaceId),
      getRecentProjects(workspaceId),
    ])

  // ── Per-stage rollup ─────────────────────────────────────────────────────
  const byStage = new Map<string, { count: number; value: number }>()
  let openDeals = 0
  let wonDeals = 0
  let openPipeline = 0
  let probabilityValue = 0
  let probabilityWeight = 0

  // ── Won-by-month accumulation, bucketed as we walk ────────────────────────
  const buckets = lastNMonthBuckets(MONTHS, now)
  const wonIndex = new Map(buckets.map((b, i) => [b.month, i]))

  for (const deal of allDeals) {
    const slot = byStage.get(deal.stageId) ?? { count: 0, value: 0 }
    slot.count += 1
    slot.value += deal.value ?? 0
    byStage.set(deal.stageId, slot)

    const stageName = deal.stage.name
    const isOpen = stageName !== WON && stageName !== LOST

    if (isOpen) {
      openDeals += 1
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
    } else if (stageName === WON) {
      wonDeals += 1
      const idx = wonIndex.get(monthKey(deal.updatedAt))
      if (idx != null) {
        buckets[idx] = {
          ...buckets[idx],
          value: buckets[idx].value + (deal.value ?? 0),
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
      units: recentProjects.reduce((s, p) => s + p._count.units, 0),
      siteVisits,
      tasks,
    },
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
