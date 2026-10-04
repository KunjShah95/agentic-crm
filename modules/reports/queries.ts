import { db } from "@/lib/db"
import { brokerContactScope, brokerScopeFilter, type ViewerScope } from "@/lib/permissions"
import { isWonKind } from "@/lib/pipeline-stages"
import { collections, funnel, inventoryHealth, sourceROI, teamVsTarget } from "./aggregate"

const BOOKING_STAGES = new Set(["BOOKING", "REGISTRATION", "POSSESSION", "CLOSED"])

export async function getFunnel(scope: ViewerScope) {
  const deals = await db.deal.findMany({
    where: { workspaceId: scope.workspaceId, ...brokerScopeFilter(scope.role, scope.brokerId) },
    select: { bookingStage: true },
  })
  return funnel(deals.map((d) => ({ bookingStage: d.bookingStage ?? null })))
}

export async function getInventoryHealth(scope: ViewerScope, opts: { projectId?: string } = {}) {
  // Deliberately NOT broker-scoped. `Unit` has no brokerId column — allocation is
  // expressed through `Deal.brokerId` — so there is no predicate to add here
  // without changing what "inventory health" means (it would become "units on my
  // deals", a different metric). The filter is applied to the deal-derived
  // reports instead. Recorded in the broker-visibility registry as
  // workspace-wide with this reason, rather than left as a silent `void`.
  const units = await db.unit.findMany({
    where: {
      workspaceId: scope.workspaceId,
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
    },
    select: { status: true },
  })
  return inventoryHealth(units)
}

export async function getCollections(scope: ViewerScope) {
  const payments = await db.payment.findMany({
    where: {
      workspaceId: scope.workspaceId,
      // Payment has no brokerId of its own; the predicate belongs on the relation.
      deal: { workspaceId: scope.workspaceId, ...brokerScopeFilter(scope.role, scope.brokerId) },
    },
    select: { status: true, amount: true, dueDate: true },
  })
  return collections(payments.map((p) => ({ status: p.status, amount: p.amount, dueDate: p.dueDate })))
}

export async function getSourceROI(scope: ViewerScope) {
  const brokerFilter = brokerScopeFilter(scope.role, scope.brokerId)
  const deals = await db.deal.findMany({
    where: { workspaceId: scope.workspaceId, ...brokerFilter },
    select: { bookingStage: true, value: true, contactId: true },
  })
  const contactIds = deals.map((d) => d.contactId).filter(Boolean) as string[]
  const contacts = contactIds.length
    ? await db.contact.findMany({
        // The workspace predicate is load-bearing here, not decorative. These
        // ids come from `deals`, which is workspace-scoped, so the list is
        // currently safe by derivation — but `open-findings.md` records that a
        // foreign `contactId` is accepted on deal create/update and then read
        // back. With no predicate here, one such deal is enough to disclose
        // another tenant's contact leadSource. Derivation is not a boundary.
        where: {
          workspaceId: scope.workspaceId,
          id: { in: contactIds },
          ...brokerContactScope(scope.role, scope.brokerId),
        },
        select: { id: true, leadSource: true },
      })
    : []
  const byContact = new Map(contacts.map((c) => [c.id, c.leadSource ?? "UNKNOWN"]))

  // also include contacts without deals as leads
  const allContacts = await db.contact.findMany({
    where: { workspaceId: scope.workspaceId, ...brokerContactScope(scope.role, scope.brokerId) },
    select: { id: true, leadSource: true },
  })
  const dealContactSet = new Set(deals.map((d) => d.contactId).filter(Boolean))
  const leadOnly = allContacts.filter((c) => !dealContactSet.has(c.id))

  const rows: { source: string; isBooking: boolean; revenue: number }[] = []

  for (const c of leadOnly) {
    rows.push({ source: c.leadSource ?? "UNKNOWN", isBooking: false, revenue: 0 })
  }
  for (const d of deals) {
    const src = d.contactId ? (byContact.get(d.contactId) ?? "UNKNOWN") : "UNKNOWN"
    const isBooking = d.bookingStage ? BOOKING_STAGES.has(d.bookingStage) : false
    rows.push({ source: src, isBooking, revenue: isBooking ? (d.value ?? 0) : 0 })
  }

  return sourceROI(rows)
}

export async function getTeamVsTarget(scope: ViewerScope) {
  const brokerFilter = brokerScopeFilter(scope.role, scope.brokerId)
  const ws = await db.workspace.findUnique({
    where: { id: scope.workspaceId },
    select: { settingsJson: true },
  })
  const settings = (ws?.settingsJson as Record<string, unknown> | null) ?? null
  const targets = (settings?.targets as Record<string, number> | undefined) ?? {}

  // The member directory is workspace-wide on purpose — a broker still needs to
  // see the team to know who to hand a lead to. Only the booking counts are
  // broker-scoped, so this shows "the rest of the team booked N" rather than
  // "the rest of the team's books", which is the intended comparison.
  const members = await db.workspaceMember.findMany({
    where: { workspaceId: scope.workspaceId },
    include: { user: { select: { id: true, name: true } } },
  })

  const deals = await db.deal.findMany({
    where: { workspaceId: scope.workspaceId, ...brokerFilter, bookingStage: { in: Array.from(BOOKING_STAGES) } },
    select: { ownerId: true },
  })
  const counts = new Map<string, number>()
  for (const d of deals) counts.set(d.ownerId, (counts.get(d.ownerId) ?? 0) + 1)

  const rows = members.map((m) => ({
    ownerId: m.userId,
    ownerName: m.user.name,
    bookings: counts.get(m.userId) ?? 0,
    target: targets[m.userId] ?? 10,
  }))

  return teamVsTarget(rows)
}

export async function getReportsSnapshot(scope: ViewerScope, opts: { projectId?: string } = {}) {
  // Every sub-report receives the same scope. This used to forward
  // `role`/`brokerId` to five of eight calls and pass the workspace id alone to
  // the other three, which is how a broker ended up with a scoped funnel beside
  // an unscoped pipeline-by-stage on one screen.
  const [funnelRows, inv, coll, roi, team, pipelineByStage, dealsByOwner, winRateByType] = await Promise.all([
    getFunnel(scope),
    getInventoryHealth(scope, { projectId: opts.projectId }),
    getCollections(scope),
    getSourceROI(scope),
    getTeamVsTarget(scope),
    getPipelineByStage(scope),
    getDealsByOwner(scope),
    getWinRateByDealType(scope),
  ])
  return { funnel: funnelRows, inventory: inv, collections: coll, sourceROI: roi, teamVsTarget: team, pipelineByStage, dealsByOwner, winRateByType }
}

export async function getPipelineByStage(scope: ViewerScope) {
  const stages = await db.pipelineStage.findMany({
    where: { workspaceId: scope.workspaceId },
    orderBy: { order: "asc" },
    select: { id: true, name: true, color: true },
  })

  const deals = await db.deal.findMany({
    where: { workspaceId: scope.workspaceId, ...brokerScopeFilter(scope.role, scope.brokerId) },
    select: { stageId: true, value: true },
  })

  const stageValues = new Map<string, { count: number; value: number }>()
  for (const stage of stages) {
    stageValues.set(stage.id, { count: 0, value: 0 })
  }
  for (const deal of deals) {
    const existing = stageValues.get(deal.stageId)
    if (existing) {
      existing.count++
      existing.value += deal.value ?? 0
    }
  }

  return stages.map((stage) => ({
    stageId: stage.id,
    name: stage.name,
    color: stage.color,
    count: stageValues.get(stage.id)?.count ?? 0,
    value: stageValues.get(stage.id)?.value ?? 0,
  }))
}

export async function getDealsByOwner(scope: ViewerScope) {
  const members = await db.workspaceMember.findMany({
    where: { workspaceId: scope.workspaceId },
    include: { user: { select: { id: true, name: true } } },
  })

  const deals = await db.deal.findMany({
    where: { workspaceId: scope.workspaceId, ...brokerScopeFilter(scope.role, scope.brokerId) },
    select: { ownerId: true, value: true },
  })

  const ownerCounts = new Map<string, { count: number; value: number }>()
  for (const member of members) {
    ownerCounts.set(member.user.id, { count: 0, value: 0 })
  }
  for (const deal of deals) {
    const owner = deal.ownerId ?? "unassigned"
    const existing = ownerCounts.get(owner) ?? { count: 0, value: 0 }
    existing.count++
    existing.value += deal.value ?? 0
    ownerCounts.set(owner, existing)
  }

  const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"]

  return members.map((m, i) => ({
    ownerId: m.user.id,
    name: m.user.name,
    count: ownerCounts.get(m.user.id)?.count ?? 0,
    value: ownerCounts.get(m.user.id)?.value ?? 0,
    color: colors[i % colors.length],
  }))
}

export async function getWinRateByDealType(scope: ViewerScope) {
  const deals = await db.deal.findMany({
    where: { workspaceId: scope.workspaceId, ...brokerScopeFilter(scope.role, scope.brokerId) },
    // `kind`, not `name` — a win rate that reads 0% because someone renamed the
    // Won stage is a chart nobody can debug.
    select: { dealType: true, stage: { select: { kind: true } } },
  })

  const byType = new Map<string, { total: number; won: number }>()
  for (const deal of deals) {
    const type = deal.dealType ?? "UNCLASSIFIED"
    const existing = byType.get(type) ?? { total: 0, won: 0 }
    existing.total++
    if (isWonKind(deal.stage.kind)) existing.won++
    byType.set(type, existing)
  }

  return Array.from(byType.entries())
    .map(([type, data]) => ({
      type,
      total: data.total,
      won: data.won,
      winRate: data.total > 0 ? Math.round((data.won / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}
