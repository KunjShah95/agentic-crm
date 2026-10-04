import { db } from "@/lib/db"
import { CHANNEL, REPLY_WINDOW_MS } from "@/modules/social/ingest"
import { brokerContactScope, type ViewerScope } from "@/lib/permissions"

/**
 * Inbox data layer.
 *
 * The inbox is a view over Activity rows — there is no separate Message model.
 * A conversation is "the activities on one contact", and a channel is the
 * `Activity.channel` string. That is deliberate (it keeps calls, notes, leads and
 * WhatsApp on one timeline) but it means every query here must stay scoped to
 * `workspaceId` or it leaks across tenants.
 *
 * Every read additionally takes a `ViewerScope` so a BROKER sees only their own
 * conversations. The inbox is the most sensitive reader in the app: a row here
 * carries message bodies, phone numbers and `optedOut` — the last being a DPDP
 * consent signal, not merely business data. An unscoped inbox is not a noisy
 * list, it is a directory of every customer conversation in the tenant.
 */

/**
 * Channels the product actually fills. X and LinkedIn were removed; any legacy
 * rows with those values stay in the DB but are no longer surfaced.
 */
export const INBOX_CHANNELS = ["WHATSAPP", "SMS", "EMAIL", "CALL", "WEB", "LEAD", "NOTE"] as const

export type InboxPreview = {
  body: string | null
  direction: string | null
  channel: string | null
  at: Date | null
  /** Outbound delivery state of the latest message (whatsapp only). */
  status: string | null
}

export type InboxContact = {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  leadScore: number | null
  leadSource: string | null
  optedOut: boolean
  last: InboxPreview
  /** True when the newest message is inbound — the agent owes a reply. */
  needsReply: boolean
}

/**
 * Contacts that have any comms activity, newest first, with a one-line preview.
 * Used by the inbox left rail.
 */
export async function listInboxContacts(
  scope: ViewerScope,
  limit = 100,
): Promise<InboxContact[]> {
  const contacts = await db.contact.findMany({
    where: {
      workspaceId: scope.workspaceId,
      ...brokerContactScope(scope.role, scope.brokerId),
      activities: { some: { channel: { in: [...INBOX_CHANNELS] } } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
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

  const previews = await latestActivityPreviews(
    scope.workspaceId,
    contacts.map((c) => c.id),
  )

  return contacts.map((c) => {
    const last = previews.get(c.id) ?? { body: null, direction: null, channel: null, at: null, status: null }
    return {
      ...c,
      last,
      needsReply: last.direction === "IN" && last.channel === CHANNEL,
    }
  })
}

/** Single query for "last message per contact" instead of N+1. */
async function latestActivityPreviews(
  workspaceId: string,
  contactIds: string[],
): Promise<Map<string, InboxPreview>> {
  const out = new Map<string, InboxPreview>()
  if (contactIds.length === 0) return out

  const rows = await db.activity.findMany({
    where: { workspaceId, contactId: { in: contactIds }, channel: { in: [...INBOX_CHANNELS] } },
    orderBy: { createdAt: "desc" },
    // Bounded so a busy workspace can't pull an unbounded result set; 10k rows
    // covers every realistic page of 100 contacts.
    take: 10_000,
    select: {
      contactId: true,
      body: true,
      direction: true,
      channel: true,
      createdAt: true,
      status: true,
    },
  })

  for (const r of rows) {
    if (!r.contactId || out.has(r.contactId)) continue // already newest
    out.set(r.contactId, {
      body: r.body,
      direction: r.direction,
      channel: r.channel,
      at: r.createdAt,
      status: r.status,
    })
  }
  return out
}

/** Contacts with activity in one channel — the inbox filter tabs. */
export async function listInboxContactsByChannel(
  scope: ViewerScope,
  channel: string,
  limit = 100,
): Promise<InboxContact[]> {
  const contacts = await db.contact.findMany({
    where: {
      workspaceId: scope.workspaceId,
      ...brokerContactScope(scope.role, scope.brokerId),
      activities: { some: { channel } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
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

  const previews = await latestActivityPreviews(
    scope.workspaceId,
    contacts.map((c) => c.id),
  )

  return contacts.map((c) => {
    const last = previews.get(c.id) ?? { body: null, direction: null, channel: null, at: null, status: null }
    return { ...c, last, needsReply: last.direction === "IN" && last.channel === CHANNEL }
  })
}

/**
 * Full merged timeline for one contact across every channel, oldest first
 * (chat order). Always filtered by workspaceId — this is a tenant boundary.
 */
export async function getContactTimeline(scope: ViewerScope, contactId: string) {
  // The contact lookup is scoped even though the timeline query filters by
  // contactId directly: without it, `/inbox/<contactId>` would render another
  // broker's conversation for any id in the tenant. Message bodies are the most
  // sensitive rows in the product.
  const visible = await db.contact.findFirst({
    where: {
      id: contactId,
      workspaceId: scope.workspaceId,
      ...brokerContactScope(scope.role, scope.brokerId),
    },
    select: { id: true },
  })
  if (!visible) return []

  return db.activity.findMany({
    where: { workspaceId: scope.workspaceId, contactId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      channel: true,
      direction: true,
      source: true,
      type: true,
      status: true,
      externalId: true,
      createdAt: true,
      socialEventId: true,
    },
  })
}

export type TimelineItem = {
  id: string
  body: string | null
  channel: string | null
  direction: string | null
  source: string | null
  type: string
  status: string | null
  /** A provider message id exists means this row can receive live receipts. */
  tracked: boolean
  createdAt: Date
}

export function toTimelineItems(
  activities: Awaited<ReturnType<typeof getContactTimeline>>,
): TimelineItem[] {
  return activities.map((a) => ({
    id: a.id,
    body: a.body,
    channel: a.channel ?? "NOTE",
    direction: a.direction,
    source: a.source,
    type: a.type,
    status: a.status,
    tracked: Boolean(a.externalId),
    createdAt: a.createdAt,
  }))
}

/**
 * Everything the composer needs to know before it lets an agent type.
 * Computed server-side so the client never guesses at policy.
 */
export async function getReplyContext(scope: ViewerScope, contactId: string) {
  const { workspaceId } = scope

  // Contact first, sequentially: the reply-window lookup must not run for a
  // contact the caller cannot see, or `lastInboundAt` discloses that *some*
  // conversation exists on a foreign id. These two cannot be concurrent because
  // the second is conditional on the first.
  const contact = await db.contact.findFirst({
    where: {
      id: contactId,
      workspaceId,
      ...brokerContactScope(scope.role, scope.brokerId),
    },
    select: { phone: true, optedOut: true },
  })

  const [lastInbound, connection] = await Promise.all([
    contact
      ? db.activity.findFirst({
          where: { workspaceId, contactId, channel: CHANNEL, direction: "IN" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
      : Promise.resolve(null),
    db.socialConnection.findFirst({
      where: { workspaceId, provider: "whatsapp", status: "active" },
      select: { id: true, displayName: true, externalAccountId: true },
    }),
  ])

  const lastInboundAt = lastInbound?.createdAt ?? null
  const windowRemainingMs = lastInboundAt ? Math.max(0, REPLY_WINDOW_MS - (Date.now() - lastInboundAt.getTime())) : null

  return {
    hasPhone: Boolean(contact?.phone),
    optedOut: Boolean(contact?.optedOut),
    connected: Boolean(connection),
    connectedNumber: connection?.displayName ?? connection?.externalAccountId ?? null,
    lastInboundAt,
    windowRemainingMs,
    /** Meta only accepts free-form text inside the 24h window. */
    windowOpen: windowRemainingMs !== null && windowRemainingMs > 0,
  }
}
