"use server"

import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { scheduleFollowUps } from "./scheduler"
import { calcLeadScore } from "@/modules/leadIngest/scoring"
import { suggestActions } from "./suggest"

export async function createFollowUps(workspaceId: string, contactId: string, userId: string) {
  await requireWorkspaceMember(workspaceId, userId)
  const contact = await db.contact.findFirst({ where: { id: contactId, workspaceId } })
  if (!contact) throw new Error("Contact not found")
  const score = contact.leadScore ?? calcLeadScore({ source: contact.leadSource ?? undefined, config: (contact.requirementsJson as Record<string, unknown> | null)?.bhk as string | undefined })
  const rows = scheduleFollowUps({ leadScore: score, createdAt: contact.createdAt, now: new Date() })
  const created = []
  for (const r of rows) {
    const act = await db.activity.create({
      data: {
        workspaceId,
        contactId,
        type: r.type as never,
        body: r.body,
        scheduledAt: r.scheduledAt,
        channel: r.channel,
        source: "agent",
        createdBy: userId,
      },
    })
    created.push(act)
  }
  return created
}

export async function getNextBestActions(workspaceId: string, contactId: string, userId: string) {
  await requireWorkspaceMember(workspaceId, userId)
  const contact = await db.contact.findFirst({ where: { id: contactId, workspaceId }, include: { activities: { orderBy: { createdAt: "desc" }, take: 1 } } })
  if (!contact) throw new Error("Contact not found")
  const deal = await db.deal.findFirst({ where: { contactId, workspaceId }, select: { bookingStage: true } })
  const last = contact.activities[0]
  const daysIdle = last ? Math.floor((Date.now() - new Date(last.createdAt).getTime()) / 86400000) : 999
  return suggestActions({
    leadScore: contact.leadScore,
    bookingStage: deal?.bookingStage ?? "INQUIRY",
    daysSinceLastActivity: daysIdle,
    lastActivityType: last?.type ?? null,
    hasPhone: !!contact.phone,
    hasEmail: !!contact.email,
  })
}
