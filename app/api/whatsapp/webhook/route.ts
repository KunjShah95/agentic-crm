import { NextResponse } from "next/server"
import crypto from "crypto"
import { db } from "@/lib/db"
import { Prisma } from "@/lib/generated/prisma/client"
import { WhatsAppProvider } from "@/modules/social/providers/whatsapp"
import { resolveInboundWorkspace, ingestWhatsAppEvents } from "@/modules/social/ingest"
import { whatsappEnabled } from "@/modules/whatsapp/config"

export const dynamic = "force-dynamic"

/**
 * The single WhatsApp inbound rail.
 *
 * There used to be two: this one (verified, but enqueueing into a queue with no
 * consumer) and a second unverified one that wrote straight to the DB. They
 * disagreed about env var names and API versions, so configuring one left the
 * other mocked. This is now the only path, and it is fail-closed.
 *
 * Contract with Meta:
 *   - GET  hub.challenge handshake, verify token must match (no token => refuse).
 *   - POST X-Hub-Signature-256 must validate, else 401 and nothing is written.
 *   - After verification we always answer 200. Failures are persisted as
 *     unprocessed WebhookEvent rows for the drain cron, never a retry storm.
 */

function headersToRecord(req: Request): Record<string, string> {
  const out: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    out[k] = v
  })
  return out
}

/** Pull the first `key` out of Meta's entry[].changes[].value nesting. */
function firstOf(payload: unknown, key: string): string | null {
  const root = payload as { entry?: Array<{ changes?: Array<{ value?: Record<string, unknown> }> }> }
  for (const entry of root?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value as
        | { metadata?: Record<string, unknown> }
        | Record<string, unknown>
        | undefined
      if (!value) continue
      const meta = (value as { metadata?: Record<string, unknown> }).metadata
      if (meta && typeof meta[key] === "string") return meta[key] as string
      if (typeof (value as Record<string, unknown>)[key] === "string") return (value as Record<string, unknown>)[key] as string
    }
  }
  return null
}

function batchDedupeKey(events: Array<{ externalId: string }>, phoneNumberId: string): string {
  const ids = events.map((e) => e.externalId).sort().join(",")
  const hash = crypto.createHash("sha256").update(`${phoneNumberId}|${ids}`).digest("hex").slice(0, 32)
  return `whatsapp:${hash}`
}

export async function GET(req: Request) {
  // Integration parked: refuse Meta's verification handshake so the webhook
  // reads as unconfigured rather than silently accepting inbound traffic.
  if (!whatsappEnabled()) {
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } })
  }
  const provider = new WhatsAppProvider()
  const url = new URL(req.url)
  const query: Record<string, string> = {}
  url.searchParams.forEach((v, k) => {
    query[k] = v
  })

  const ok = await provider.verifyWebhook({ query })
  if (!ok) {
    return new Response("Forbidden", { status: 403, headers: { "Content-Type": "text/plain" } })
  }
  const challenge = query["hub.challenge"] ?? ""
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } })
}

export async function POST(req: Request) {
  if (!whatsappEnabled()) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  const rawBody = await req.text()
  const provider = new WhatsAppProvider()

  let body: unknown = {}
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ received: true, note: "unparseable body" }, { status: 200 })
  }

  const verified = await provider.verifyWebhook({
    headers: headersToRecord(req),
    rawBody,
  })
  if (!verified) {
    // Unverified payloads must not reach the DB at all.
    console.warn("[whatsapp:webhook] rejected: signature verification failed")
    return NextResponse.json({ error: "invalid signature" }, { status: 401 })
  }

  const events = provider.parseEvents(body)
  if (events.length === 0) {
    return NextResponse.json({ received: true, ignored: "no messages or statuses" }, { status: 200 })
  }

  const phoneNumberId = firstOf(body, "phone_number_id")
  const firstMessage = events.find((e) => e.kind === "message")
  const senderNumber = firstMessage && firstMessage.kind === "message" ? firstMessage.from.number ?? null : null
  const dedupeKey = batchDedupeKey(events, phoneNumberId ?? "unknown")

  // Record the batch first: this is what makes a Meta retry a no-op and what
  // leaves a recoverable row when routing or ingest fails.
  let webhookEventId: string | undefined
  try {
    const created = await db.webhookEvent.create({
      data: {
        source: "whatsapp",
        payload: body as Prisma.InputJsonValue,
        dedupeKey,
      },
      select: { id: true },
    })
    webhookEventId = created.id
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ received: true, deduped: true }, { status: 200 })
    }
    console.error("[whatsapp:webhook] batch persist failed", e)
    return NextResponse.json({ received: true, note: "batch not recorded" }, { status: 200 })
  }

  try {
    const route = await resolveInboundWorkspace({
      phoneNumberId,
      senderNumber,
    })

    if (route.status !== "resolved") {
      // Parked, not dropped: processedAt stays null so /api/cron/whatsapp-drain
      // picks it up once an account is linked.
      console.warn(`[whatsapp:webhook] unrouted batch ${dedupeKey}: ${route.status}`, route)
      return NextResponse.json({ received: true, routed: false, reason: route.status }, { status: 200 })
    }

    const result = await ingestWhatsAppEvents({
      workspaceId: route.workspaceId,
      events,
      raw: body,
      phoneNumberId,
    })

    if (webhookEventId) {
      await db.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processedAt: new Date(), workspaceId: route.workspaceId },
      })
    }

    return NextResponse.json({ received: true, ...result, via: route.via }, { status: 200 })
  } catch (err) {
    console.error("[whatsapp:webhook] process error", err)
    // 200 keeps Meta from hammering us; the row stays unprocessed for the drain.
    return NextResponse.json({ received: true, queued: false, note: "recorded for replay" }, { status: 200 })
  }
}
