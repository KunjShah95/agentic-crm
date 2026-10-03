/**
 * Lead-ingress authentication and outbound-safety configuration.
 *
 * The ingress endpoints are public by definition — a Meta lead-form webhook and
 * a browser form on a project micro-site are both called by strangers. What
 * they must never be is *writable* by a stranger: before this module,
 * `/api/webhooks/leads/[source]` accepted an unauthenticated POST from anyone
 * who knew a workspace slug, and `processLead` auto-acked new leads over
 * WhatsApp. Combined, that let a third party make a paying customer's business
 * number send unsolicited messages to arbitrary phone numbers — a WhatsApp
 * policy ban on their account, bought by us.
 *
 * Two independent controls, deliberately not collapsed into one:
 *
 * 1. `secretHash` — a per-workspace shared secret for server-to-server
 *    ingress (Meta, portals, Zapier). Browser forms cannot set headers, so
 *    they cannot use it; they are covered by (2) plus the rate limiter.
 * 2. `autoAck` — whether this workspace wants WhatsApp auto-acks at all.
 *    Defaults OFF. Outbound messaging is the only irreversible thing the lead
 *    pipeline does, so it is opt-in rather than opt-out.
 *
 * Secrets are stored as sha256 hashes in `Workspace.settingsJson`, matching
 * `modules/platform/apiKeys.ts` — no migration, and a leaked database row does
 * not yield a working key.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto"
import { db } from "@/lib/db"

type LeadIngestSettings = {
  secretHash?: string
  autoAck?: boolean
  updatedAt?: string
}

const SETTINGS_PATH = "leadIngest"

export function hashIngestSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

/** Constant-time compare of two hex digests of equal expected length. */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex")
  const bufB = Buffer.from(b, "hex")
  if (bufA.length !== bufB.length || bufA.length === 0) return false
  return timingSafeEqual(bufA, bufB)
}

export async function getLeadIngestSettings(workspaceId: string): Promise<LeadIngestSettings> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { settingsJson: true },
  })
  const settings = (ws?.settingsJson as Record<string, unknown> | null) ?? {}
  const cfg = (settings[SETTINGS_PATH] as LeadIngestSettings | undefined) ?? {}
  return cfg
}

async function patchLeadIngestSettings(
  workspaceId: string,
  patch: LeadIngestSettings
): Promise<void> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { settingsJson: true },
  })
  const settings = (ws?.settingsJson as Record<string, unknown> | null) ?? {}
  const current = (settings[SETTINGS_PATH] as LeadIngestSettings | undefined) ?? {}
  await db.workspace.update({
    where: { id: workspaceId },
    data: {
      settingsJson: {
        ...settings,
        [SETTINGS_PATH]: { ...current, ...patch, updatedAt: new Date().toISOString() },
      },
    },
  })
}

/**
 * Mint an ingest secret. The plaintext is returned once and never stored —
 * store it in the portal's webhook config, then discard it.
 */
export async function createIngestSecret(
  workspaceId: string,
  userId: string
): Promise<{ secret: string }> {
  const secret = `lei_${randomBytes(24).toString("hex")}`
  await patchLeadIngestSettings(workspaceId, { secretHash: hashIngestSecret(secret) })
  await db.activity.create({
    data: {
      workspaceId,
      type: "NOTE",
      body: "Lead ingest secret created — server-to-server lead webhooks now require it",
      createdBy: userId,
      source: "system",
    },
  })
  return { secret }
}

export async function revokeIngestSecret(workspaceId: string, userId: string): Promise<void> {
  await patchLeadIngestSettings(workspaceId, { secretHash: undefined })
  await db.activity.create({
    data: {
      workspaceId,
      type: "NOTE",
      body: "Lead ingest secret revoked",
      createdBy: userId,
      source: "system",
    },
  })
}

/**
 * Outbound WhatsApp auto-ack is opt-in per workspace.
 *
 * Defaults false. Turning it on is a deliberate act by someone who has
 * confirmed their lead sources are ones where the enquirer gave their number
 * in good faith — a published form, a Meta lead ad, a portal export.
 */
export async function isAutoAckEnabled(workspaceId: string): Promise<boolean> {
  return (await getLeadIngestSettings(workspaceId)).autoAck === true
}

/**
 * Same rule as `isAutoAckEnabled`, for callers that already hold the
 * workspace row (the public micro-site reads `settingsJson` to decide whether
 * to promise a WhatsApp acknowledgement it may not send).
 */
export function autoAckFromSettings(settingsJson: unknown): boolean {
  const settings = (settingsJson as Record<string, unknown> | null) ?? {}
  const cfg = (settings[SETTINGS_PATH] as LeadIngestSettings | undefined) ?? {}
  return cfg.autoAck === true
}

export async function setAutoAck(
  workspaceId: string,
  enabled: boolean,
  userId: string
): Promise<void> {
  await patchLeadIngestSettings(workspaceId, { autoAck: enabled })
  await db.activity.create({
    data: {
      workspaceId,
      type: "NOTE",
      body: `WhatsApp lead auto-ack ${enabled ? "enabled" : "disabled"}`,
      createdBy: userId,
      source: "system",
    },
  })
}

/** Accept the key from any of the header spellings portals actually send. */
export function extractIngestKey(req: Request): string | null {
  const direct =
    req.headers.get("x-estate360-ingest-key") ?? req.headers.get("x-ingest-key")
  if (direct && direct.trim()) return direct.trim()
  const auth = req.headers.get("authorization")
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim()
    if (token) return token
  }
  return null
}

export type IngressAuthResult = { ok: true } | { ok: false; status: 401 | 503; error: string }

/**
 * Authorize a server-to-server lead webhook.
 *
 * A workspace with no secret configured is a configuration error, not a
 * pass: in production we return 503 so the portal's retry logic leaves the
 * events queued instead of silently dropping leads, and the owner sees a
 * broken webhook rather than an empty pipeline. Outside production we allow
 * it through so `npm run dev` and the seed work without setup, and warn.
 */
export async function requireIngressAuth(
  req: Request,
  workspaceId: string
): Promise<IngressAuthResult> {
  const { secretHash } = await getLeadIngestSettings(workspaceId)

  if (!secretHash) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[leadIngest] no ingest secret configured — accepting unauthenticated lead webhook (dev only)"
      )
      return { ok: true }
    }
    return {
      ok: false,
      status: 503,
      error: "Lead ingest not configured for this workspace",
    }
  }

  const provided = extractIngestKey(req)
  if (!provided) {
    return {
      ok: false,
      status: 401,
      error: "Missing ingest key — send it as x-estate360-ingest-key",
    }
  }
  if (!safeEqualHex(hashIngestSecret(provided), secretHash)) {
    return { ok: false, status: 401, error: "Invalid ingest key" }
  }
  return { ok: true }
}