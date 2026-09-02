/**
 * Webhook replay — reprocesses unprocessed WebhookEvent rows through the lead
 * worker. A null processedAt means the event was queued but its processing
 * never completed (crash, transient DB error, dedupe race); replay is safe
 * because processLead is idempotent on WebhookEvent.dedupeKey.
 *
 * Runs from the admin replay endpoint or a Vercel Cron poll.
 */

import { db } from "@/lib/db"
import { processLead } from "@/modules/leadIngest/worker"

export type ReplayResult = { total: number; processed: number; failed: number }

export async function replayPending(opts?: { workspaceId?: string; limit?: number }): Promise<ReplayResult> {
  const { workspaceId, limit = 50 } = opts ?? {}
  const events = await db.webhookEvent.findMany({
    where: { processedAt: null, ...(workspaceId ? { workspaceId } : {}) },
    take: limit,
    orderBy: { createdAt: "asc" },
  })

  let processed = 0
  let failed = 0
  for (const e of events) {
    try {
      if (!e.workspaceId) throw new Error("event has no workspaceId — cannot route to a tenant")
      await processLead({ workspaceId: e.workspaceId, source: e.source, payload: e.payload })
      processed++
    } catch (err) {
      // Leave processedAt null so the event stays replayable; log and continue.
      console.error(`[replay] event ${e.id} failed`, (err as Error).message)
      failed++
    }
  }
  return { total: events.length, processed, failed }
}
