import { db } from "@/lib/db"
import {
  effectiveCommissionPct,
  expectedCommission,
  normalizeDealType,
  normalizeUrgency,
} from "./commission"

export async function getPipeline(workspaceId: string) {
  const [stages, deals] = await Promise.all([
    db.pipelineStage.findMany({
      where: { workspaceId },
      orderBy: { order: "asc" },
      include: { _count: { select: { deals: true } } },
    }),
    db.deal.findMany({
      where: { workspaceId },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        organization: { select: { id: true, name: true } },
        tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ])

  return { stages, deals }
}

export async function listDealsForTable(workspaceId: string) {
  return db.deal.findMany({
    where: { workspaceId },
    include: {
      stage: { select: { id: true, name: true, color: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      organization: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  })
}

export async function getDealDetail(workspaceId: string, dealId: string) {
  const deal = await db.deal.findFirst({
    where: { id: dealId, workspaceId },
    include: {
      stage: { select: { id: true, name: true, color: true, order: true } },
      contact: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      organization: {
        select: { id: true, name: true, domain: true, industry: true },
      },
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      activities: {
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })
  return deal
}

export async function pipelineStats(workspaceId: string) {
  const deals = await db.deal.findMany({
    where: { workspaceId },
    select: {
      title: true,
      value: true,
      dealType: true,
      urgency: true,
      stage: { select: { name: true } },
      unit: {
        select: {
          config: true,
          project: { select: { name: true } },
        },
      },
      commissionRules: { select: { amount: true, pct: true, status: true } },
    },
  })
  // A stage is "closed" once it's Won or Lost — those deals are no longer part
  // of the active pipeline. The stage name is load-bearing (see prisma/seed.ts).
  const isClosed = (name: string) => name === "Won" || name === "Lost"
  const openDeals = deals.filter((d) => !isClosed(d.stage.name))
  const wonDeals = deals.filter((d) => d.stage.name === "Won")

  // Open pipeline only: never fold Won/Lost deals into "Total pipeline".
  const total = openDeals.reduce((sum, d) => sum + (d.value ?? 0), 0)
  const won = wonDeals.reduce((sum, d) => sum + (d.value ?? 0), 0)

  // Company take on won deals: real assigned commission wins; otherwise the
  // weighted projection from deal type + urgency.
  let committed = 0
  let projected = 0
  let urgentWon = 0
  const byDeal: {
    name: string
    type: string
    take: number
    assigned: boolean
  }[] = []
  const byType = new Map<string, { count: number; value: number; take: number; pctSum: number }>()
  for (const d of wonDeals) {
    const type = normalizeDealType(d.dealType, d.unit?.config)
    const urgency = normalizeUrgency(d.urgency)
    const assigned = d.commissionRules.reduce(
      (s, c) => s + (c.amount ?? ((d.value ?? 0) * (c.pct ?? 0)) / 100),
      0
    )
    const take = Math.round(assigned || expectedCommission(d.value ?? 0, type, urgency))
    if (assigned > 0) committed += Math.round(assigned)
    else projected += take
    if (urgency === "HIGH" || urgency === "DISTRESS") urgentWon++
    byDeal.push({
      name: d.title || d.unit?.project?.name || "Untitled deal",
      type,
      take,
      assigned: assigned > 0,
    })
    const row = byType.get(type) ?? { count: 0, value: 0, take: 0, pctSum: 0 }
    row.count++
    row.value += d.value ?? 0
    row.take += take
    // average effective % across this type's won deals (urgency-adjusted)
    row.pctSum += effectiveCommissionPct(type, urgency)
    byType.set(type, row)
  }

  return {
    total,
    won,
    count: openDeals.length,
    allCount: deals.length,
    take: {
      committed,
      projected,
      total: committed + projected,
      urgentWon,
      byDeal: byDeal.sort((a, b) => b.take - a.take),
      byType: [...byType.entries()]
        .map(([type, v]) => ({ type, ...v, avgPct: v.pctSum / v.count }))
        .sort((a, b) => b.take - a.take),
    },
  }
}
