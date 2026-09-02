import { db } from "@/lib/db"
import { cpScopeFilter } from "@/lib/permissions"
import type { Role } from "@/lib/generated/prisma/client"

/**
 * Deals for the booking board — CP-scoped. Includes unit + contact so cards can
 * show what is being booked and the payment progress.
 */
export async function listBookings(ctx: { workspaceId: string; role: Role; cpId?: string | null }) {
  const scope = cpScopeFilter(ctx.role, ctx.cpId)
  return db.deal.findMany({
    where: { workspaceId: ctx.workspaceId, ...scope },
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: {
      id: true,
      title: true,
      bookingStage: true,
      value: true,
      cpId: true,
      contact: { select: { firstName: true, lastName: true } },
      unit: { select: { id: true, unitNo: true, status: true, price: true } },
      _count: { select: { payments: true } },
    },
  })
}

/** Units available to book (AVAILABLE or HOLD) for the wizard picker. */
export async function listBookableUnits(workspaceId: string) {
  return db.unit.findMany({
    where: { workspaceId, status: { in: ["AVAILABLE", "HOLD"] } },
    orderBy: { unitNo: "asc" },
    select: { id: true, unitNo: true, status: true, price: true },
    take: 500,
  })
}

/** Payment plans for a workspace's projects (for the wizard). */
export async function listPaymentPlans(workspaceId: string) {
  return db.paymentPlan.findMany({
    where: { project: { workspaceId } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, projectId: true },
  })
}
