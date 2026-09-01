import { db } from "@/lib/db"

/**
 * Contacts with recent comms activity, newest first — the inbox left rail.
 */
export async function listInboxContacts(workspaceId: string) {
  return db.contact.findMany({
    where: {
      workspaceId,
      activities: { some: { channel: { in: ["WHATSAPP", "LEAD", "SMS", "EMAIL"] } } },
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
    },
  })
}
