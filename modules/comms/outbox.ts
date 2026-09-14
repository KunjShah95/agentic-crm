/**
 * Outbound messaging (WhatsApp).
 *
 * One place decides whether a message may leave, sends it through the provider
 * seam, and records the timeline row with the real provider id so Meta's
 * delivery receipts can find the bubble again.
 *
 * Every rejection is a typed code with a user-facing explanation — the old path
 * swallowed provider errors and still returned success, so a "sent" message
 * could quietly never exist.
 */

import { revalidatePath } from "next/cache"
import crypto from "crypto"
import { db } from "@/lib/db"
import { AppError } from "@/lib/errors"
import { requireQuota } from "@/modules/billing/quota"
import { WhatsAppProvider } from "@/modules/social/providers/whatsapp"
import { getActiveConnection, decryptAccessToken } from "@/modules/social/connections"
import { replyWindowRemaining } from "@/modules/social/ingest"
import { getWhatsAppConfig, whatsappReadiness, whatsappEnabled } from "@/modules/whatsapp/config"

export type OutboundFailure =
  | "EMPTY_BODY"
  | "CONTACT_NOT_FOUND"
  | "NO_PHONE"
  | "OPTED_OUT"
  | "WINDOW_CLOSED"
  | "NOT_CONFIGURED"
  | "QUOTA_EXCEEDED"
  | "PROVIDER_ERROR"

export type OutboundResult =
  | { ok: true; activityId: string; messageId: string; mock: boolean }
  | { ok: false; code: OutboundFailure; message: string }

/**
 * Meta only allows free-form text inside the 24h customer-service window opened
 * by the customer's last inbound message. Outside it, only pre-approved template
 * messages are allowed (not built yet), so we refuse rather than silently fail.
 */
function enforceWindow(): boolean {
  const flag = process.env.WHATSAPP_ENFORCE_REPLY_WINDOW
  if (flag === "false" || flag === "0") return false
  if (flag === "true" || flag === "1") return true
  return process.env.NODE_ENV === "production"
}

export async function sendOutboundWhatsAppMessage(params: {
  workspaceId: string
  workspaceSlug: string
  userId: string
  contactId: string
  body: string
}): Promise<OutboundResult> {
  const { workspaceId, workspaceSlug, userId, contactId } = params
  const body = params.body?.trim() ?? ""
  if (!body) return { ok: false, code: "EMPTY_BODY", message: "Write a message first." }

  if (!whatsappEnabled()) {
    return { ok: false, code: "NOT_CONFIGURED", message: "WhatsApp messaging is currently disabled." }
  }

  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId },
    select: { id: true, phone: true, optedOut: true },
  })
  if (!contact) return { ok: false, code: "CONTACT_NOT_FOUND", message: "Contact not found." }
  if (contact.optedOut) {
    return { ok: false, code: "OPTED_OUT", message: "This contact opted out of messaging." }
  }
  if (!contact.phone) {
    return { ok: false, code: "NO_PHONE", message: "This contact has no phone number to send to." }
  }

  if (enforceWindow()) {
    const remaining = await replyWindowRemaining(workspaceId, contactId)
    if (!remaining) {
      return {
        ok: false,
        code: "WINDOW_CLOSED",
        message: "WhatsApp only allows replies within 24 hours of the customer's last message. Ask them to message in first.",
      }
    }
  }

  const provider = new WhatsAppProvider()
  const connection = await getActiveConnection(workspaceId, "whatsapp")

  let accessToken: string | null = null
  let metadata: Record<string, unknown> = {}
  if (connection) {
    try {
      accessToken = decryptAccessToken(connection.accessTokenEnc)
    } catch {
      return { ok: false, code: "NOT_CONFIGURED", message: "Stored WhatsApp token could not be decrypted — reconnect the account." }
    }
    metadata = (connection.metadata as Record<string, unknown> | null) ?? {}
  }

  let messageId = ""
  let mock = false

  const cfg = getWhatsAppConfig()
  if (!accessToken) {
    // No per-workspace connection: fall back to the platform-shared credentials.
    accessToken = cfg.accessToken
    metadata = { ...metadata, phoneNumberId: metadata.phoneNumberId ?? cfg.phoneNumberId }
  }

  if (!accessToken || !metadata.phoneNumberId) {
    const readiness = whatsappReadiness(cfg)
    // Opt-in dev mock, clearly labelled, so the UI can be exercised without
    // credentials. Never available in production, and never silent.
    if (process.env.NODE_ENV !== "production" && process.env.WHATSAPP_ALLOW_MOCK === "true") {
      mock = true
      messageId = `mock-${crypto.randomUUID()}`
    } else {
      return {
        ok: false,
        code: "NOT_CONFIGURED",
        message: `WhatsApp isn't connected yet. Link an account, or set ${readiness.missing.join(", ")}.`,
      }
    }
  }

  try {
    await requireQuota(workspaceId, "social_messages")
  } catch (err) {
    if (err instanceof AppError && err.code === "QUOTA_EXCEEDED") {
      return { ok: false, code: "QUOTA_EXCEEDED", message: "Monthly message quota reached. Upgrade the plan to keep sending." }
    }
    throw err
  }

  if (!mock) {
    try {
      const res = await provider.send({ accessToken: accessToken!, metadata, to: contact.phone, body })
      messageId = res.externalId
      mock = res.mock
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // A rejected/rotated token should tell the admin to reconnect, not just fail.
      if (connection && /190|invalid.*token|expired/i.test(message)) {
        await db.socialConnection.update({ where: { id: connection.id }, data: { status: "needs_reauth" } })
      }
      console.error("[outbox:whatsapp] send failed", err)
      return { ok: false, code: "PROVIDER_ERROR", message: `WhatsApp did not accept the message: ${message}` }
    }
  }

  const activity = await db.activity.create({
    data: {
      workspaceId,
      type: "NOTE",
      contactId,
      body,
      source: "whatsapp",
      channel: "WHATSAPP",
      direction: "OUT",
      externalId: mock ? null : messageId,
      // "mock" is its own visible state — a dev send must never look delivered.
      status: mock ? "mock" : "sent",
      statusAt: mock ? null : new Date(),
      createdBy: userId,
    },
    select: { id: true },
  })

  // revalidatePath keys on the URL, and the URL is the slug — not the cuid.
  revalidatePath(`/${workspaceSlug}/inbox`)
  revalidatePath(`/${workspaceSlug}/contacts/${contactId}`)

  return { ok: true, activityId: activity.id, messageId, mock }
}

/** Used by the settings card to answer "is sending actually possible right now?" */
export function outboundCapability() {
  const r = whatsappReadiness()
  return { canSend: r.canSend, canReceive: r.canReceive, missing: r.missing }
}
