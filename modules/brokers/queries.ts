import { db } from "@/lib/db"
import { brokerScopeFilter } from "@/lib/permissions"
import type { Role } from "@/lib/generated/prisma/client"

/**
 * Units visible to the caller. BROKER-role users see only units allocated to
 * their deals (deal.brokerId = their brokerId); everyone else sees all workspace units.
 */
export async function listVisibleUnits(ctx: { workspaceId: string; role: Role; brokerId?: string | null }) {
  const scope = brokerScopeFilter(ctx.role, ctx.brokerId)
  if (scope.brokerId) {
    return db.unit.findMany({
      where: { workspaceId: ctx.workspaceId, deals: { some: { brokerId: scope.brokerId } } },
      orderBy: { unitNo: "asc" },
    })
  }
  return db.unit.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { unitNo: "asc" } })
}

/** Deals visible to the caller, broker-scoped. */
export async function listVisibleDeals(ctx: { workspaceId: string; role: Role; brokerId?: string | null }) {
  const scope = brokerScopeFilter(ctx.role, ctx.brokerId)
  return db.deal.findMany({
    where: { workspaceId: ctx.workspaceId, ...scope },
    orderBy: { createdAt: "desc" },
  })
}

/** Commission ledger for a broker (or all, for admins). */
export async function listCommissions(ctx: { workspaceId: string; role: Role; brokerId?: string | null }) {
  const scope = brokerScopeFilter(ctx.role, ctx.brokerId)
  return db.commissionRule.findMany({
    where: { workspaceId: ctx.workspaceId, ...scope },
    orderBy: { createdAt: "desc" },
    include: { broker: { select: { name: true } }, deal: { select: { title: true } } },
  })
}

/** All brokers in a workspace (admin directory). */
export async function listBrokers(workspaceId: string) {
  return db.broker.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      reraNo: true,
      brokerage: true,
      userId: true,
      _count: { select: { deals: true, commissionRules: true } },
    },
  })
}

/** Resolve the Broker id linked to a user (for broker-scoped views). */
export async function resolveBrokerId(workspaceId: string, userId: string): Promise<string | null> {
  const broker = await db.broker.findFirst({ where: { workspaceId, userId }, select: { id: true } })
  return broker?.id ?? null
}
