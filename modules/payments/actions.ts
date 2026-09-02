"use server"

import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { auth } from "@/lib/auth"
import { generateCLP, DEFAULT_CLP, type MilestoneTemplate } from "./clp"

async function authed(workspaceId: string) {
  const s = await auth()
  if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  return s.user.id
}

/**
 * Materialize a CLP into Payment rows for a deal. Uses the plan's milestones
 * when a paymentPlanId is given, else the standard 8-stage DEFAULT_CLP.
 * Splits `total` so the Payment amounts sum exactly to the total.
 * Returns the created payment count. Idempotent-guarded by the caller.
 */
export async function materializeCLP(input: {
  workspaceId: string
  dealId: string
  total: number
  paymentPlanId?: string
}): Promise<{ count: number }> {
  let templates: MilestoneTemplate[] = DEFAULT_CLP
  let milestoneIdByOrder: (string | undefined)[] = []

  if (input.paymentPlanId) {
    const milestones = await db.paymentMilestone.findMany({
      where: { planId: input.paymentPlanId },
      orderBy: { order: "asc" },
    })
    if (milestones.length) {
      templates = milestones.map((m) => ({ label: m.label, pct: m.pct, dueTrigger: m.dueTrigger ?? undefined, daysAfter: m.daysAfter ?? undefined }))
      milestoneIdByOrder = milestones.map((m) => m.id)
    }
  }

  const rows = generateCLP(input.total, templates)
  for (const r of rows) {
    await db.payment.create({
      data: {
        workspaceId: input.workspaceId,
        dealId: input.dealId,
        milestoneId: milestoneIdByOrder[r.order] ?? null,
        amount: r.amount,
        status: "DUE",
      },
    })
  }
  return { count: rows.length }
}

/**
 * Attach a payment plan to a deal and generate its Payment schedule.
 */
export async function attachPaymentPlan(input: { workspaceId: string; dealId: string; paymentPlanId: string }) {
  await authed(input.workspaceId)
  const deal = await db.deal.findFirst({
    where: { id: input.dealId, workspaceId: input.workspaceId },
    include: { costSheet: true, unit: true },
  })
  if (!deal) throw new Error("Deal not found")
  const total = deal.costSheet?.total ?? deal.unit?.price ?? deal.value ?? 0
  await db.deal.update({ where: { id: deal.id }, data: { paymentPlanId: input.paymentPlanId } })
  return materializeCLP({ workspaceId: input.workspaceId, dealId: deal.id, total, paymentPlanId: input.paymentPlanId })
}
