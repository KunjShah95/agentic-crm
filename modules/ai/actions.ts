"use server"

import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { auth } from "@/lib/auth"
import { scheduleFollowUps } from "./scheduler"
import { calcLeadScore } from "@/modules/leadIngest/scoring"
import { suggestActions } from "./suggest"

/**
 * Resolve the acting user from the session and prove workspace membership.
 *
 * These two exports used to take `userId` as a parameter and pass it to
 * `requireWorkspaceMember`. That verifies *that user* is a member, not that the
 * *caller* is that user — and in a `"use server"` file the argument is
 * client-supplied JSON. An anonymous caller could therefore pass a real
 * member's id, clear the gate, and have TASK activities written onto that
 * member's workspace timeline with `createdBy` set to them. The identity is now
 * taken from the session, matching every other action module here.
 */
async function authed(workspaceId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, session.user.id)
  return session.user.id
}

export async function createFollowUps(workspaceId: string, contactId: string) {
  const userId = await authed(workspaceId)
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

export async function getNextBestActions(workspaceId: string, contactId: string) {
  await authed(workspaceId)
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
