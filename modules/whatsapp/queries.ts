import { db } from "@/lib/db"

/**
 * Contacts with recent comms activity, newest first — the inbox left rail.
 * Includes WhatsApp, SMS, Email, Call, Web, LEAD, and social (X/LinkedIn) channels.
 */
export async function listInboxContacts(workspaceId: string) {
  return db.contact.findMany({
    where: {
      workspaceId,
      activities: {
        some: {
          channel: {
            in: ["WHATSAPP", "SMS", "EMAIL", "CALL", "WEB", "LEAD", "X", "LINKEDIN"],
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      leadScore: true,
      leadSource: true,
      optedOut: true,
    },
  })
}

/**
 * Contacts with activity in a specific channel — for inbox filter tabs.
 */
export async function listInboxContactsByChannel(
  workspaceId: string,
  channel: string,
) {
  return db.contact.findMany({
    where: {
      workspaceId,
      activities: { some: { channel } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      leadScore: true,
      leadSource: true,
      optedOut: true,
    },
  })
}

/**
 * Full merged timeline for one contact — all activities across channels.
 * Includes social events with provider context via socialEvent relation.
 */
export async function getContactTimeline(workspaceId: string, contactId: string) {
  return db.activity.findMany({
    where: { workspaceId, contactId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      channel: true,
      direction: true,
      source: true,
      type: true,
      createdAt: true,
      socialEventId: true,
      socialEvent: {
        select: {
          provider: true,
          type: true,
        },
      },
    },
  })
}

/**
 * Timeline items for the inbox UI — merges socialEvent provider into channel label.
 */
export function toTimelineItems(
  activities: Awaited<ReturnType<typeof getContactTimeline>>,
) {
  return activities.map((a) => ({
    id: a.id,
    body: a.body,
    channel: a.socialEvent ? `${a.socialEvent.provider.toUpperCase()}` : a.channel ?? "NOTE",
    direction: a.direction,
    source: a.source,
    type: a.type,
    createdAt: a.createdAt,
    socialProvider: a.socialEvent?.provider ?? null,
  }))
}
