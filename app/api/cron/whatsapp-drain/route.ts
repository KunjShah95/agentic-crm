import { NextResponse } from "next/server"
import crypto from "crypto"
import { db } from "@/lib/db"
import { WhatsAppProvider } from "@/modules/social/providers/whatsapp"
import { resolveInboundWorkspace, ingestWhatsAppEvents } from "@/modules/social/ingest"
import type { NormalizedMessage } from "@/modules/social/types"

export const dynamic = "force-dynamic"

/**
 * Drain for WhatsApp webhook batches that could not be processed on arrival.
 *
 * A batch is left unprocessed when the tenant could not be resolved (e.g. the
 * number was not linked yet) or when ingest threw. Once an admin links the
 * account, this run recovers everything that was parked instead of losing it.
 *
 * Scheduled from vercel.json. Protected by CRON_SECRET.
 */

const SOURCE = "whatsapp"
const BATCH = 25

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Without a secret this endpoint would let anyone replay webhook batches.
    if (process.env.NODE_ENV === "production") return false
    return true
  }
  const header = req.headers.get("authorization") ?? ""
  const token = header.replace(/^Bearer\s+/i, "")
  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const pending = await db.webhookEvent.findMany({
    where: { source: SOURCE, processedAt: null },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true, dedupeKey: true, payload: true },
  })

  const provider = new WhatsAppProvider()
  let recovered = 0
  let stillParked = 0
  const failures: string[] = []

  for (const row of pending) {
    try {
      const events = provider.parseEvents(row.payload)
      if (events.length === 0) {
        await db.webhookEvent.update({ where: { id: row.id }, data: { processedAt: new Date() } })
        continue
      }
      const firstMessage = events.find((e): e is NormalizedMessage => e.kind === "message")
      const senderNumber = firstMessage ? firstMessage.from.number ?? null : null
      const phoneNumberId = firstMessage?.threadId ?? null

      const route = await resolveInboundWorkspace({ phoneNumberId, senderNumber })
      if (route.status !== "resolved") {
        stillParked++
        continue
      }

      await ingestWhatsAppEvents({ workspaceId: route.workspaceId, events, raw: row.payload, phoneNumberId })
      await db.webhookEvent.update({
        where: { id: row.id },
        data: { processedAt: new Date(), workspaceId: route.workspaceId },
      })
      recovered++
    } catch (err) {
      failures.push(`${row.dedupeKey}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    scanned: pending.length,
    recovered,
    stillParked,
    failures: failures.slice(0, 5),
  })
}
