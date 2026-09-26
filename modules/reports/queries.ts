import { db } from "@/lib/db"
import { brokerScopeFilter } from "@/lib/permissions"
import type { Role } from "@/lib/generated/prisma/client"
import { collections, funnel, inventoryHealth, sourceROI, teamVsTarget } from "./aggregate"

const BOOKING_STAGES = new Set(["BOOKING", "REGISTRATION", "POSSESSION", "CLOSED"])

export async function getFunnel(workspaceId: string, role?: Role, brokerId?: string | null) {
  const brokerFilter = role ? brokerScopeFilter(role, brokerId) : {}
  const deals = await db.deal.findMany({
    where: { workspaceId, ...brokerFilter },
    select: { bookingStage: true },
  })
  return funnel(deals.map((d) => ({ bookingStage: d.bookingStage ?? null })))
}

export async function getInventoryHealth(
  workspaceId: string,
  opts: { projectId?: string; role?: Role; brokerId?: string | null } = {},
) {
  const brokerFilter = opts.role ? brokerScopeFilter(opts.role, opts.brokerId) : {}
  // brokers see no inventory unless allocated — for reports we simply apply same filter to deals; units are not broker-scoped in M3, so return full
  void brokerFilter
  const units = await db.unit.findMany({
    where: {
      workspaceId,
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
    },
    select: { status: true },
  })
  return inventoryHealth(units)
}

export async function getCollections(workspaceId: string, role?: Role, brokerId?: string | null) {
  const brokerFilter = role ? brokerScopeFilter(role, brokerId) : {}
  const payments = await db.payment.findMany({
    where: {
      workspaceId,
      deal: { workspaceId, ...brokerFilter },
    },
    select: { status: true, amount: true, dueDate: true },
  })
  return collections(payments.map((p) => ({ status: p.status, amount: p.amount, dueDate: p.dueDate })))
}

export async function getSourceROI(workspaceId: string, role?: Role, brokerId?: string | null) {
  const brokerFilter = role ? brokerScopeFilter(role, brokerId) : {}
  const deals = await db.deal.findMany({
    where: { workspaceId, ...brokerFilter },
    select: { bookingStage: true, value: true, contactId: true },
  })
  const contactIds = deals.map((d) => d.contactId).filter(Boolean) as string[]
  const contacts = contactIds.length
    ? await db.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, leadSource: true } })
    : []
  const byContact = new Map(contacts.map((c) => [c.id, c.leadSource ?? "UNKNOWN"]))

  // also include contacts without deals as leads
  const allContacts = await db.contact.findMany({ where: { workspaceId }, select: { id: true, leadSource: true } })
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

export async function getTeamVsTarget(workspaceId: string, role?: Role, brokerId?: string | null) {
  const brokerFilter = role ? brokerScopeFilter(role, brokerId) : {}
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { settingsJson: true } })
  const settings = (ws?.settingsJson as Record<string, unknown> | null) ?? null
  const targets = (settings?.targets as Record<string, number> | undefined) ?? {}

  const members = await db.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true } } },
  })

  const deals = await db.deal.findMany({
    where: { workspaceId, ...brokerFilter, bookingStage: { in: Array.from(BOOKING_STAGES) } },
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

export async function getReportsSnapshot(
  workspaceId: string,
  opts: { projectId?: string; role?: Role; brokerId?: string | null } = {},
) {
  const [funnelRows, inv, coll, roi, team, pipelineByStage, dealsByOwner, winRateByType] = await Promise.all([
    getFunnel(workspaceId, opts.role, opts.brokerId),
    getInventoryHealth(workspaceId, { projectId: opts.projectId, role: opts.role, brokerId: opts.brokerId }),
    getCollections(workspaceId, opts.role, opts.brokerId),
    getSourceROI(workspaceId, opts.role, opts.brokerId),
    getTeamVsTarget(workspaceId, opts.role, opts.brokerId),
    getPipelineByStage(workspaceId),
    getDealsByOwner(workspaceId),
    getWinRateByDealType(workspaceId),
  ])
  return { funnel: funnelRows, inventory: inv, collections: coll, sourceROI: roi, teamVsTarget: team, pipelineByStage, dealsByOwner, winRateByType }
}

export async function getPipelineByStage(workspaceId: string) {
  const stages = await db.pipelineStage.findMany({
    where: { workspaceId },
    orderBy: { order: "asc" },
    select: { id: true, name: true, color: true },
  })

  const deals = await db.deal.findMany({
    where: { workspaceId },
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

export async function getDealsByOwner(workspaceId: string) {
  const members = await db.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true } } },
  })

  const deals = await db.deal.findMany({
    where: { workspaceId },
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

export async function getWinRateByDealType(workspaceId: string) {
  const deals = await db.deal.findMany({
    where: { workspaceId },
    select: { dealType: true, stage: { select: { name: true } } },
  })

  const byType = new Map<string, { total: number; won: number }>()
  for (const deal of deals) {
    const type = deal.dealType ?? "UNCLASSIFIED"
    const existing = byType.get(type) ?? { total: 0, won: 0 }
    existing.total++
    if (deal.stage.name === "Won") existing.won++
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
