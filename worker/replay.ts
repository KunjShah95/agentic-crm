/**
 * Webhook replay — reprocesses unprocessed WebhookEvent rows through the lead
 * worker. A null processedAt means the event was queued but its processing
 * never completed (crash, transient DB error, dedupe race); replay is safe
 * because processLead is idempotent on WebhookEvent.dedupeKey.
 *
 * Runs from the admin replay endpoint or a Vercel Cron poll.
 *
 * Refactored to use `processBatch` from the queue module instead of
 * duplicating the processing logic.
 */

import { db } from "@/lib/db"
import { processBatch } from "@/modules/leadIngest/queue"

export type ReplayResult = { total: number; processed: number; failed: number }

export async function replayPending(opts?: { workspaceId?: string; limit?: number }): Promise<ReplayResult> {
  const { workspaceId, limit = 50 } = opts ?? {}

  if (workspaceId) {
    const result = await processBatch(workspaceId, limit)
    return { total: result.processed + result.failed, ...result }
  }

  // No workspaceId: process across all workspaces that have pending events.
  const pendingRows = await db.webhookEvent.findMany({
    where: { processedAt: null },
    select: { workspaceId: true },
    distinct: ["workspaceId"],
  })

  let totalProcessed = 0
  let totalFailed = 0

  for (const row of pendingRows) {
    if (!row.workspaceId) continue
    const result = await processBatch(row.workspaceId, limit)
    totalProcessed += result.processed
    totalFailed += result.failed
  }

  return { total: totalProcessed + totalFailed, processed: totalProcessed, failed: totalFailed }
}
