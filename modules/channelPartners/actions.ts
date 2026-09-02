"use server"

import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { auth } from "@/lib/auth"
import { channelPartnerSchema, commissionSchema } from "@/lib/validators/re"
import { computeCommission } from "./commission"

async function authed(workspaceId: string, minRole?: "ADMIN") {
  const s = await auth()
  if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id, minRole)
  return s.user.id
}

/** Onboard a channel partner (ADMIN+). */
export async function onboardCp(input: { workspaceId: string; data: unknown }) {
  await authed(input.workspaceId, "ADMIN")
  const p = channelPartnerSchema.parse(input.data)
  return db.channelPartner.create({
    data: {
      workspaceId: input.workspaceId,
      name: p.name,
      reraNo: p.reraNo || null,
      brokerage: p.brokerage ?? null,
      userId: p.userId || null,
    },
  })
}

/**
 * Assign a commission on a booked deal. Amount is derived from the deal value
 * via computeCommission (explicit amount wins, else pct). ADMIN+.
 */
export async function assignCommission(input: { workspaceId: string; data: unknown }) {
  await authed(input.workspaceId, "ADMIN")
  const p = commissionSchema.parse(input.data)
  const deal = await db.deal.findFirst({
    where: { id: p.dealId, workspaceId: input.workspaceId },
    include: { costSheet: true, unit: true },
  })
  if (!deal) throw new Error("Deal not found")
  const dealValue = deal.costSheet?.total ?? deal.unit?.price ?? deal.value ?? 0
  const amount = computeCommission(dealValue, { pct: p.pct ?? undefined, amount: p.amount ?? undefined })

  // Link the CP onto the deal so CP-scoped queries can see it.
  await db.deal.update({ where: { id: deal.id }, data: { cpId: p.cpId } })

  return db.commissionRule.create({
    data: {
      workspaceId: input.workspaceId,
      dealId: p.dealId,
      cpId: p.cpId,
      pct: p.pct ?? null,
      amount,
      status: "PENDING",
    },
  })
}
