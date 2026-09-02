"use server"

import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { canTransition, isBookingStage } from "./stages"
import { materializeCLP } from "@/modules/payments/actions"
import { buildDocContext, renderDocument } from "@/modules/documents/render"

async function authed(workspaceId: string) {
  const s = await auth()
  if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  return s.user.id
}

/** Advance a deal's bookingStage, enforcing the forward-only machine. */
async function advanceStage(workspaceId: string, dealId: string, to: string) {
  if (!isBookingStage(to)) throw new Error(`Invalid stage: ${to}`)
  const deal = await db.deal.findFirst({ where: { id: dealId, workspaceId } })
  if (!deal) throw new Error("Deal not found")
  const from = deal.bookingStage ?? "INQUIRY"
  if (from !== to && !canTransition(from, to)) {
    throw new Error(`Cannot move booking from ${from} to ${to}`)
  }
  return deal
}

/** Place a soft hold on a unit and move the deal to HOLD. */
export async function holdUnit(input: { workspaceId: string; dealId: string; unitId: string; hours?: number }) {
  const userId = await authed(input.workspaceId)
  await advanceStage(input.workspaceId, input.dealId, "HOLD")
  const holdUntil = new Date(Date.now() + (input.hours ?? 48) * 3600_000)

  await db.unit.update({ where: { id: input.unitId }, data: { status: "HOLD", holdUntil } })
  await db.deal.update({ where: { id: input.dealId }, data: { unitId: input.unitId, bookingStage: "HOLD" } })
  await db.activity.create({
    data: {
      workspaceId: input.workspaceId,
      type: "NOTE",
      dealId: input.dealId,
      body: `Unit held until ${holdUntil.toISOString()}`,
      source: "system",
      channel: "SITE_VISIT",
      createdBy: userId,
    },
  })
  revalidatePath(`/${input.workspaceId}/bookings`)
  return { holdUntil }
}

/** Record KYC/bank details captured in the booking wizard onto the contact. */
export async function recordKyc(input: { workspaceId: string; contactId: string; kyc: Record<string, unknown> }) {
  await authed(input.workspaceId)
  const contact = await db.contact.findFirst({ where: { id: input.contactId, workspaceId: input.workspaceId } })
  if (!contact) throw new Error("Contact not found")
  await db.contact.update({ where: { id: contact.id }, data: { kycJson: input.kyc as object } })
  return { ok: true }
}

/**
 * Confirm a booking — the M3 acceptance chain:
 * unit → BOOKED, deal → BOOKING, CLP milestones materialized as Payment rows,
 * demand letter #1 generated from the DEMAND_LETTER template. Workspace-scoped.
 */
export async function confirmBooking(input: {
  workspaceId: string
  dealId: string
  unitId: string
  paymentPlanId?: string
}) {
  const userId = await authed(input.workspaceId)
  await advanceStage(input.workspaceId, input.dealId, "BOOKING")

  const deal = await db.deal.findFirst({
    where: { id: input.dealId, workspaceId: input.workspaceId },
    include: { costSheet: true, unit: { include: { project: true } }, contact: true },
  })
  if (!deal) throw new Error("Deal not found")

  const unit = deal.unit ?? (await db.unit.findFirst({ where: { id: input.unitId, workspaceId: input.workspaceId }, include: { project: true } }))
  if (!unit) throw new Error("Unit not found")
  const total = deal.costSheet?.total ?? unit.price ?? deal.value ?? 0

  // 1. Unit → BOOKED
  await db.unit.update({ where: { id: unit.id }, data: { status: "BOOKED", holdUntil: null } })

  // 2. Deal → BOOKING (+ link unit/plan)
  await db.deal.update({
    where: { id: deal.id },
    data: { bookingStage: "BOOKING", unitId: unit.id, paymentPlanId: input.paymentPlanId ?? deal.paymentPlanId ?? null },
  })

  // 3. CLP → Payment rows
  const clp = await materializeCLP({ workspaceId: input.workspaceId, dealId: deal.id, total, paymentPlanId: input.paymentPlanId ?? deal.paymentPlanId ?? undefined })

  // 4. Demand letter #1 from the workspace DEMAND_LETTER template (if any)
  let demandDocId: string | undefined
  const template = await db.documentTemplate.findFirst({ where: { workspaceId: input.workspaceId, kind: "DEMAND_LETTER" } })
  if (template) {
    const workspace = await db.workspace.findUnique({ where: { id: input.workspaceId } })
    const firstMilestoneAmount = Math.round(total * 0.1) // first CLP milestone (On Booking) = 10%
    const ctx = buildDocContext({
      workspace: workspace ? { name: workspace.name, settingsJson: (workspace.settingsJson as { rera?: string } | null) ?? undefined } : undefined,
      project: unit.project ? { name: unit.project.name, reraNo: unit.project.reraNo } : undefined,
      unit: { unitNo: unit.unitNo, carpetArea: unit.carpetArea, builtUp: unit.builtUp },
      costSheet: deal.costSheet ? { basePrice: deal.costSheet.basePrice, gst: deal.costSheet.gst, stampDuty: deal.costSheet.stampDuty, total: deal.costSheet.total } : { total },
      contact: deal.contact ? { firstName: deal.contact.firstName, lastName: deal.contact.lastName } : undefined,
      extra: { milestone: "On Booking", demand_amount: firstMilestoneAmount.toLocaleString("en-IN") },
    })
    const rendered = renderDocument(template.bodyHtml, ctx)
    const doc = await db.generatedDocument.create({
      data: { workspaceId: input.workspaceId, dealId: deal.id, unitId: unit.id, templateId: template.id, renderedHtml: rendered },
    })
    demandDocId = doc.id
  }

  // 5. Timeline
  await db.activity.create({
    data: {
      workspaceId: input.workspaceId,
      type: "NOTE",
      dealId: deal.id,
      contactId: deal.contactId ?? null,
      body: `Booking confirmed for unit ${unit.unitNo}. ${clp.count} payment milestones scheduled.`,
      source: "system",
      channel: "SITE_VISIT",
      createdBy: userId,
    },
  })

  revalidatePath(`/${input.workspaceId}/bookings`)
  return { dealId: deal.id, unitId: unit.id, milestones: clp.count, demandDocId, total }
}
