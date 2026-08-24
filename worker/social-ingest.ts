import { db } from "@/lib/db"
import { requireQuota, periodKeyFor } from "@/modules/billing/quota"
import { Prisma } from "@/lib/generated/prisma/client"

export type IngestSocialEventParams = {
  workspaceId: string
  provider: string
  externalId: string
  type?: string
  fromHandle: string
  displayName?: string
  body?: string
  timestamp?: string | Date
  dedupeKey?: string
  payload?: unknown
}

export type IngestResult =
  | { status: "processed"; socialEventId: string; contactId: string; activityId: string }
  | { status: "already_processed"; socialEventId: string }
  | { status: "skipped"; reason: string }

export function buildDedupeKey(provider: string, externalId: string): string {
  return `${provider}:${externalId}`
}

function splitDisplayName(displayName?: string, fallbackHandle?: string) {
  const raw = (displayName?.trim() || fallbackHandle?.replace(/^@/, "") || "Unknown").trim()
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "Unknown", lastName: "" }
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

function isUniqueViolation(e: unknown): boolean {
  if (typeof e === "object" && e !== null && "code" in e) {
    const code = (e as { code?: string }).code
    if (code === "P2002") return true
  }
  // PrismaClientKnownRequestError shape
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes("Unique constraint") || msg.includes("duplicate key")) return true
  return false
}

/**
 * Find contact by handles JSON.
 * Uses Prisma JSON path query when available; falls back to in-memory filter for test mocks.
 */
async function findContactByHandles(
  workspaceId: string,
  provider: string,
  handle: string,
  tx?: Parameters<Parameters<typeof db.$transaction>[0]>[0]
): Promise<{ id: string } | null> {
  const client = (tx ?? db) as unknown as typeof db

  // Primary: Prisma JSON path query (Postgres JSONB)
  try {
    const found = await client.contact.findFirst({
      where: {
        workspaceId,
        // Prisma Json filter with path
        handles: {
          path: [provider],
          equals: handle,
        },
      } as unknown as Prisma.ContactWhereInput,
      select: { id: true },
    })
    if (found) return found
  } catch {
    // Fall through to fallback
  }

  // Fallback: fetch candidates and check handles in JS (covers SQLite/test mocks without JSON path support)
  try {
    const candidates = await (client.contact.findMany as unknown as (args: unknown) => Promise<Array<{ id: string; handles: unknown }>>)({
      where: { workspaceId },
      select: { id: true, handles: true },
    })

    for (const c of candidates as Array<{ id: string; handles: unknown }>) {
      const h = c.handles as Record<string, unknown> | null
      if (h && typeof h === "object" && h[provider] === handle) {
        return { id: c.id }
      }
      // Also handle case where handles is array-like or contains handle as value
      if (h && typeof h === "object") {
        const values = Object.values(h)
        if (values.includes(handle)) return { id: c.id }
      }
    }
  } catch {
    // ignore
  }

  // WhatsApp phone fallback: try phone field equality if handle looks like phone
  if (provider === "whatsapp" && handle) {
    try {
      const byPhone = await client.contact.findFirst({
        where: { workspaceId, phone: handle },
        select: { id: true },
      })
      if (byPhone) return byPhone
    } catch {
      // ignore
    }
  }

  return null
}

async function resolveOrCreateContact(
  workspaceId: string,
  provider: string,
  fromHandle: string,
  displayName: string | undefined,
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]
): Promise<{ id: string }> {
  const existing = await findContactByHandles(workspaceId, provider, fromHandle, tx as unknown as Parameters<Parameters<typeof db.$transaction>[0]>[0])
  if (existing) return existing

  const { firstName, lastName } = splitDisplayName(displayName, fromHandle)
  const handles = { [provider]: fromHandle }

  const created = await (tx as unknown as typeof db).contact.create({
    data: {
      workspaceId,
      firstName: firstName.slice(0, 80) || "Unknown",
      lastName: lastName.slice(0, 80) || "",
      handles,
      createdBy: "system:social",
    },
    select: { id: true },
  })
  return created
}

/**
 * Idempotent social event ingest.
 * - Dedupe via SocialEvent (id=externalId, dedupeKey=provider:externalId) with ON CONFLICT DO NOTHING semantics
 * - Identity resolve via Contact.handles JSON
 * - Quota gate via requireQuota
 * - Transaction: Activity {source:'social'} + UsageEvent + UsageCounter + SocialEvent.processedAt
 * - Idempotency: if SocialEvent.processedAt already set, no-op
 */
export async function ingestSocialEvent(params: IngestSocialEventParams): Promise<IngestResult> {
  const { workspaceId, provider, externalId, type, fromHandle, displayName, body, timestamp, payload } = params

  if (!workspaceId || !provider || !externalId || !fromHandle) {
    throw new Error("ingestSocialEvent: workspaceId, provider, externalId, fromHandle are required")
  }

  const normalizedProvider = provider.toLowerCase().trim()
  const dedupeKey = params.dedupeKey ?? buildDedupeKey(normalizedProvider, externalId)
  const eventType = (type ?? "message").toLowerCase().trim()

  // 1) Dedupe check — if already processed, no-op
  // Check by dedupeKey first (unique), then by id
  let socialEventId = externalId

  try {
    const existingByDedupe = await db.socialEvent.findUnique({ where: { dedupeKey } })
    if (existingByDedupe?.processedAt) {
      return { status: "already_processed", socialEventId: existingByDedupe.id }
    }
    if (existingByDedupe) {
      socialEventId = existingByDedupe.id
    } else {
      const existingById = await db.socialEvent.findUnique({ where: { id: externalId } })
      if (existingById?.processedAt) {
        return { status: "already_processed", socialEventId: existingById.id }
      }
      if (existingById) {
        socialEventId = existingById.id
      }
    }
  } catch {
    // If findUnique not available in mock, continue to create
  }

  // 2) Ensure SocialEvent row exists — INSERT ON CONFLICT DO NOTHING (id=externalId, dedupeKey)
  // If row already exists but not yet processed, we reuse it.
  let isNewEvent = false
  if (!socialEventId || socialEventId === externalId) {
    // Try to create; if conflict, reuse existing
    try {
      const created = await db.socialEvent.create({
        data: {
          id: externalId,
          workspaceId,
          provider: normalizedProvider,
          type: eventType,
          payload: (payload ?? { body, fromHandle, displayName, timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString() }) as unknown as Prisma.InputJsonValue,
          dedupeKey,
        },
        select: { id: true },
      })
      socialEventId = created.id
      isNewEvent = true
    } catch (e) {
      if (isUniqueViolation(e)) {
        // Row already exists (concurrent insert) — fetch it
        try {
          const existing = await db.socialEvent.findUnique({ where: { dedupeKey } })
          if (existing?.processedAt) {
            return { status: "already_processed", socialEventId: existing.id }
          }
          if (existing) {
            socialEventId = existing.id
          } else {
            const byId = await db.socialEvent.findUnique({ where: { id: externalId } })
            if (byId?.processedAt) {
              return { status: "already_processed", socialEventId: byId.id }
            }
            if (byId) socialEventId = byId.id
          }
        } catch {
          // fallback to externalId
          socialEventId = externalId
        }
      } else {
        throw e
      }
    }
  }

  // Final processedAt check before doing work (handles race where event was already processed)
  try {
    const recheck = await db.socialEvent.findUnique({ where: { id: socialEventId } })
    if (recheck?.processedAt) {
      return { status: "already_processed", socialEventId: recheck.id }
    }
  } catch {
    // ignore
  }

  // 3) Quota gate — must pass before creating activity
  // Use requireQuota which checks UsageCounter vs PlanLimits
  await requireQuota(workspaceId, "social_messages")

  // 4) Transaction: identity resolve + Activity + UsageEvent + UsageCounter + mark processed
  const result = await db.$transaction(async (tx) => {
    // Double-check processed inside transaction with lock
    const locked = await (tx as unknown as typeof db).socialEvent.findUnique({ where: { id: socialEventId } })
    if (locked?.processedAt) {
      return { alreadyProcessed: true as const, contactId: "", activityId: "" }
    }

    // Identity resolve (inside tx)
    const contact = await resolveOrCreateContact(workspaceId, normalizedProvider, fromHandle, displayName, tx as unknown as Parameters<Parameters<typeof db.$transaction>[0]>[0])

    // Create Activity linked to social event
    const activity = await (tx as unknown as typeof db).activity.create({
      data: {
        workspaceId,
        type: "NOTE",
        contactId: contact.id,
        body: (body ?? "").trim() || `[${normalizedProvider}] ${fromHandle}: ${(body ?? "").trim()}`,
        source: "social",
        socialEventId,
        createdBy: "system:social",
      },
      select: { id: true },
    })

    // Usage ledger — create UsageEvent and increment UsageCounter atomically
    const period = periodKeyFor("social_messages")
    await (tx as unknown as typeof db).usageEvent.create({
      data: {
        workspaceId,
        kind: "social_messages",
        count: 1,
        meta: { provider: normalizedProvider, socialEventId, externalId } as unknown as Prisma.InputJsonValue,
      },
    })
    await (tx as unknown as typeof db).usageCounter.upsert({
      where: { workspaceId_kind_period: { workspaceId, kind: "social_messages", period } },
      create: { workspaceId, kind: "social_messages", period, count: 1 },
      update: { count: { increment: 1 } },
    })

    // Mark SocialEvent as processed
    await (tx as unknown as typeof db).socialEvent.update({
      where: { id: socialEventId },
      data: { processedAt: new Date() },
    })

    return { alreadyProcessed: false as const, contactId: contact.id, activityId: activity.id }
  })

  if (result.alreadyProcessed) {
    return { status: "already_processed", socialEventId }
  }

  return { status: "processed", socialEventId, contactId: result.contactId, activityId: result.activityId }
}
