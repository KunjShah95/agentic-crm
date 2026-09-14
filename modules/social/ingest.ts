/**
 * WhatsApp inbound ingest — synchronous and idempotent.
 *
 * Design: there is no queue. Vercel serverless cannot host a BullMQ consumer,
 * and `bullmq`/`ioredis` were never installed, so the previous "enqueue" step
 * pushed jobs into an in-memory array that nothing ever read. Instead each
 * webhook is processed inline here, and durability comes from Postgres:
 *
 *   WebhookEvent   raw batch + dedupeKey, processedAt = null until done
 *                  -> what /api/cron/whatsapp-drain retries.
 *   SocialEvent    per-message dedupeKey (`whatsapp:<wamid>`) -> replay-safe.
 *   Activity       the timeline row the inbox renders.
 *
 * Idempotency matters because Meta retries aggressively on any non-200.
 */

import { db } from "@/lib/db"
import { Prisma } from "@/lib/generated/prisma/client"
import { AppError } from "@/lib/errors"
import { requireQuota } from "@/modules/billing/quota"
import { findConnectionsByPhoneNumberId, decryptAccessToken, touchLastSync } from "./connections"
import type { NormalizedEvent, NormalizedMessage, NormalizedStatus } from "./types"

export const PROVIDER = "whatsapp"
export const CHANNEL = "WHATSAPP"
/** Meta's customer-service window: free-form replies only inside 24h of last inbound. */
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000

export function normalizePhone(raw: string | undefined | null): string {
  return (raw ?? "").replace(/[^\d]/g, "")
}

/** Last 10 digits — matches how the repo already compares Indian numbers. */
export function phoneLookupKey(raw: string | null | undefined): string {
  const digits = normalizePhone(raw)
  return digits.slice(-10)
}

export type InboundRoute =
  | { status: "resolved"; workspaceId: string; via: string }
  | { status: "ambiguous"; candidates: string[] }
  | { status: "unresolved" }

/**
 * Decide which workspace an inbound message belongs to.
 *
 * Order: explicit connection binding -> legacy settingsJson binding -> unique
 * contact owner -> configured default workspace. Anything that could hand one
 * tenant's customer to another tenant is reported rather than guessed.
 */
export async function resolveInboundWorkspace(params: {
  phoneNumberId?: string | null
  senderNumber?: string | null
}): Promise<InboundRoute> {
  const { phoneNumberId, senderNumber } = params

  if (phoneNumberId) {
    const conns = await findConnectionsByPhoneNumberId(phoneNumberId)
    if (conns.length === 1) {
      return { status: "resolved", workspaceId: conns[0].workspaceId, via: "connection" }
    }
    if (conns.length > 1) {
      // Shared number bound by several tenants: only the sender's existing
      // contact can disambiguate, and only if it is owned by exactly one.
      const owner = await uniqueContactOwner(senderNumber, conns.map((c) => c.workspaceId))
      if (owner) return { status: "resolved", workspaceId: owner, via: "connection+contact" }
      return { status: "ambiguous", candidates: conns.map((c) => c.workspaceId) }
    }
  }

  if (phoneNumberId) {
    const legacy = await db.workspace.findMany({
      where: { settingsJson: { path: ["whatsappPhoneId"], equals: phoneNumberId } },
      select: { id: true },
      take: 2,
    })
    if (legacy.length === 1) {
      return { status: "resolved", workspaceId: legacy[0].id, via: "settings" }
    }
    if (legacy.length > 1) {
      return { status: "ambiguous", candidates: legacy.map((w) => w.id) }
    }
  }

  const owner = await uniqueContactOwner(senderNumber)
  if (owner) return { status: "resolved", workspaceId: owner, via: "contact" }

  const defaultSlug = process.env.WHATSAPP_DEFAULT_WORKSPACE
  if (defaultSlug) {
    const ws = await db.workspace.findUnique({ where: { slug: defaultSlug }, select: { id: true } })
    if (ws) return { status: "resolved", workspaceId: ws.id, via: "default" }
  }

  return { status: "unresolved" }
}

async function uniqueContactOwner(senderNumber?: string | null, within?: string[]): Promise<string | null> {
  const key = phoneLookupKey(senderNumber ?? "")
  if (!key) return null
  const contacts = await db.contact.findMany({
    where: { phone: { contains: key }, ...(within?.length ? { workspaceId: { in: within } } : {}) },
    select: { workspaceId: true },
    take: 5,
  })
  const workspaces = new Set(contacts.map((c) => c.workspaceId))
  return workspaces.size === 1 ? [...workspaces][0] : null
}

async function findContactByPhone(workspaceId: string, senderNumber: string) {
  const key = phoneLookupKey(senderNumber)
  if (!key) return null
  return db.contact.findFirst({
    where: { workspaceId, OR: [{ phone: { contains: key } }, { handles: { path: ["whatsapp"], equals: senderNumber } }] },
    select: { id: true },
  })
}

function splitName(displayName: string | undefined, fallback: string) {
  const raw = (displayName?.trim() || fallback || "WhatsApp contact").trim()
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "WhatsApp", lastName: "" }
  if (parts.length === 1) return { firstName: parts[0].slice(0, 80), lastName: "" }
  return { firstName: parts[0].slice(0, 80), lastName: parts.slice(1).join(" ").slice(0, 80) }
}

export type IngestMessageResult =
  | { kind: "message"; status: "created"; socialEventId: string; contactId: string; activityId: string }
  | { kind: "message"; status: "duplicate"; socialEventId: string }
  | { kind: "message"; status: "quota_exceeded"; socialEventId: string }

/**
 * Store one inbound message. Creates the Contact when an unknown number reaches
 * out — a fresh number messaging the business is a lead, not garbage to drop.
 */
export async function ingestInboundMessage(
  workspaceId: string,
  event: NormalizedMessage,
  rawPayload: unknown,
): Promise<IngestMessageResult> {
  const sender = event.from.number ?? event.from.handle ?? "unknown"
  const dedupeKey = `${PROVIDER}:${event.externalId}`

  const existing = await db.socialEvent.findUnique({ where: { dedupeKey }, select: { id: true, processedAt: true } })
  if (existing?.processedAt) return { kind: "message", status: "duplicate", socialEventId: existing.id }

  let socialEventId = existing?.id ?? event.externalId
  if (!existing) {
    try {
      const created = await db.socialEvent.create({
        data: {
          id: event.externalId,
          workspaceId,
          provider: PROVIDER,
          type: "message",
          payload: { ...(typeof rawPayload === "object" && rawPayload ? rawPayload : {}), externalId: event.externalId } as Prisma.InputJsonValue,
          dedupeKey,
        },
        select: { id: true },
      })
      socialEventId = created.id
    } catch (e) {
      if (isUniqueViolation(e)) {
        const found = await db.socialEvent.findUnique({ where: { dedupeKey }, select: { id: true, processedAt: true } })
        if (found?.processedAt) return { kind: "message", status: "duplicate", socialEventId: found.id }
        if (found) socialEventId = found.id
      } else {
        throw e
      }
    }
  }

  try {
    return await db.$transaction(async (tx) => {
      const already = await tx.socialEvent.findUnique({ where: { id: socialEventId }, select: { processedAt: true } })
      if (already?.processedAt) {
        return { kind: "message" as const, status: "duplicate" as const, socialEventId }
      }

      await requireQuota(workspaceId, "social_messages", tx)

      let contact = await findContactByPhone(workspaceId, sender)
      if (!contact) {
        const { firstName, lastName } = splitName(event.from.name, sender)
        contact = await tx.contact.create({
          data: {
            workspaceId,
            firstName,
            lastName,
            phone: sender,
            handles: { whatsapp: sender } as Prisma.InputJsonValue,
            leadSource: "whatsapp-inbound",
            // Inbound is itself the consent to reply; we never fabricate opt-in.
            consentAt: new Date(),
            createdBy: "system:whatsapp",
          },
          select: { id: true },
        })
      }

      const activity = await tx.activity.create({
        data: {
          workspaceId,
          type: "NOTE",
          contactId: contact.id,
          body: event.body,
          source: "whatsapp",
          channel: CHANNEL,
          direction: "IN",
          externalId: event.externalId,
          createdBy: "system:whatsapp",
          socialEventId,
        },
        select: { id: true },
      })

      await tx.socialEvent.update({ where: { id: socialEventId }, data: { processedAt: new Date() } })
      return { kind: "message" as const, status: "created" as const, socialEventId, contactId: contact.id, activityId: activity.id }
    })
  } catch (e) {
    if (e instanceof AppError && e.code === "QUOTA_EXCEEDED") {
      // Leave processedAt null so the message is recoverable after an upgrade.
      return { kind: "message", status: "quota_exceeded", socialEventId }
    }
    throw e
  }
}

/** Receipt ordering: never let a late/duplicate webhook move a bubble backwards. */
const STATUS_RANK: Record<NormalizedStatus["status"], number> = { failed: 1, sent: 2, delivered: 3, read: 4 }

export async function applyDeliveryStatus(workspaceId: string, event: NormalizedStatus) {
  const target = await db.activity.findFirst({
    where: { workspaceId, externalId: event.externalId, direction: "OUT" },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true },
  })
  if (!target) return { updated: false, reason: "unknown_wamid" as const }

  const current = target.status ? STATUS_RANK[target.status as NormalizedStatus["status"]] : 0
  if (current >= STATUS_RANK[event.status]) return { updated: false, reason: "not_regressing" as const }

  await db.activity.update({
    where: { id: target.id },
    data: { status: event.status, statusAt: new Date(), body: event.status === "failed" && event.error ? `${event.error}` : undefined },
  })
  return { updated: true, activityId: target.id }
}

export type IngestBatchResult = {
  workspaceId: string
  messages: number
  duplicates: number
  statuses: number
  quotaExceeded: boolean
}

/** Process a verified webhook batch end to end. */
export async function ingestWhatsAppEvents(params: {
  workspaceId: string
  events: NormalizedEvent[]
  raw: unknown
  phoneNumberId?: string | null
}): Promise<IngestBatchResult> {
  const { workspaceId, events, raw } = params
  let messages = 0
  let duplicates = 0
  let statuses = 0
  let quotaExceeded = false

  for (const ev of events) {
    if (ev.kind === "message") {
      const r = await ingestInboundMessage(workspaceId, ev, raw)
      if (r.status === "created") messages++
      else if (r.status === "duplicate") duplicates++
      else quotaExceeded = true
    } else {
      const r = await applyDeliveryStatus(workspaceId, ev)
      if (r.updated) statuses++
    }
  }

  if (params.phoneNumberId) {
    const [conn] = await findConnectionsByPhoneNumberId(params.phoneNumberId)
    if (conn) await touchLastSync(conn.id).catch(() => {})
  }

  return { workspaceId, messages, duplicates, statuses, quotaExceeded }
}

function isUniqueViolation(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) return e.code === "P2002"
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes("Unique constraint") || msg.includes("duplicate key")
}

/** Newest inbound in the reply window — the gate for free-form outbound sends. */
export async function lastInboundAt(workspaceId: string, contactId: string): Promise<Date | null> {
  const row = await db.activity.findFirst({
    where: { workspaceId, contactId, channel: CHANNEL, direction: "IN" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  return row?.createdAt ?? null
}

export async function replyWindowRemaining(workspaceId: string, contactId: string): Promise<number | null> {
  const last = await lastInboundAt(workspaceId, contactId)
  if (!last) return null
  const remaining = REPLY_WINDOW_MS - (Date.now() - last.getTime())
  return remaining > 0 ? remaining : 0
}

export { decryptAccessToken }
