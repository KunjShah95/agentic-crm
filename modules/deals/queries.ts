import { db } from "@/lib/db"

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
    select: { value: true, probability: true, stage: { select: { name: true } } },
  })
  const total = deals.reduce((sum, d) => sum + (d.value ?? 0), 0)
  const weighted = deals.reduce(
    (sum, d) => sum + ((d.value ?? 0) * (d.probability ?? 0)) / 100,
    0
  )
  const won = deals
    .filter((d) => d.stage.name === "Won")
    .reduce((sum, d) => sum + (d.value ?? 0), 0)
  return { total, weighted, won, count: deals.length }
}
