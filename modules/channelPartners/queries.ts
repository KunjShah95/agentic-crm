import { db } from "@/lib/db"
import { cpScopeFilter } from "@/lib/permissions"
import type { Role } from "@/lib/generated/prisma/client"

/**
 * Units visible to the caller. CP-role users see only units allocated to their
 * deals (deal.cpId = their cpId); everyone else sees all workspace units.
 */
export async function listVisibleUnits(ctx: { workspaceId: string; role: Role; cpId?: string | null }) {
  const scope = cpScopeFilter(ctx.role, ctx.cpId)
  if (scope.cpId) {
    return db.unit.findMany({
      where: { workspaceId: ctx.workspaceId, deals: { some: { cpId: scope.cpId } } },
      orderBy: { unitNo: "asc" },
    })
  }
  return db.unit.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { unitNo: "asc" } })
}

/** Deals visible to the caller, CP-scoped. */
export async function listVisibleDeals(ctx: { workspaceId: string; role: Role; cpId?: string | null }) {
  const scope = cpScopeFilter(ctx.role, ctx.cpId)
  return db.deal.findMany({
    where: { workspaceId: ctx.workspaceId, ...scope },
    orderBy: { createdAt: "desc" },
  })
}

/** Commission ledger for a CP (or all, for admins). */
export async function listCommissions(ctx: { workspaceId: string; role: Role; cpId?: string | null }) {
  const scope = cpScopeFilter(ctx.role, ctx.cpId)
  return db.commissionRule.findMany({
    where: { workspaceId: ctx.workspaceId, ...scope },
    orderBy: { createdAt: "desc" },
  })
}
