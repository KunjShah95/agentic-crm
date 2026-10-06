/**
 * Lead ingest queue — async worker queue abstraction backed by WebhookEvent.
 *
 * The WebhookEvent table acts as a durable queue: `processedAt = null` means
 * the event is pending; a non-null `processedAt` means it has been processed.
 * This module provides the enqueue/process/stats operations used by the
 * webhook route (enqueue), the worker endpoint (batch process), and the
 * replay utility (batch process).
 *
 * All operations are workspace-scoped — events from other workspaces are
 * never touched.
 */

import { db } from "@/lib/db"
import { processLead, type ProcessLeadResult } from "./worker"
import { normalizeLead } from "./normalize"

export type EnqueueResult = {
  eventId: string
  dedupeKey: string
}

export type QueueStats = {
  pending: number
  processed: number
  failed: number
  oldestPendingAt: Date | null
}

export type BatchResult = {
  processed: number
  failed: number
}

/**
 * Enqueue a lead payload for async processing.
 *
 * Normalizes the payload to derive a dedupeKey, then creates a WebhookEvent
 * row (or returns the existing one if the dedupeKey was already seen). The
 * event is processed later by `processNext` or `processBatch`.
 *
 * The `trusted` parameter is accepted for signature compatibility with the
 * webhook route but is not persisted — the WebhookEvent model has no
 * `trusted` column. Async processing therefore never triggers the WhatsApp
 * auto-ack (which requires `trusted: true`). This is a safe default: a lead
 * captured asynchronously is not eligible for outbound messaging.
 */
export async function enqueueLead(
  workspaceId: string,
  source: string,
  payload: unknown,
  trusted?: boolean
): Promise<EnqueueResult> {
  const lead = normalizeLead(source, payload)

  const existing = await db.webhookEvent.findUnique({
    where: { dedupeKey: lead.dedupeKey },
  })
  if (existing) {
    return { eventId: existing.id, dedupeKey: lead.dedupeKey }
  }

  const event = await db.webhookEvent.create({
    data: {
      workspaceId,
      source: lead.source,
      payload: lead.raw as object,
      dedupeKey: lead.dedupeKey,
    },
  })

  return { eventId: event.id, dedupeKey: lead.dedupeKey }
}

/**
 * Process the oldest unprocessed event for a workspace.
 *
 * Returns the ProcessLeadResult, or null if no pending events exist.
 * Workspace-scoped: only events matching `workspaceId` are considered.
 */
export async function processNext(workspaceId: string): Promise<ProcessLeadResult | null> {
  const event = await db.webhookEvent.findFirst({
    where: { workspaceId, processedAt: null },
    orderBy: { createdAt: "asc" },
  })

  if (!event) return null

  return processLead({
    workspaceId: event.workspaceId!,
    source: event.source,
    payload: event.payload,
  })
}

/**
 * Get queue statistics for a workspace.
 *
 * `failed` is always 0 — the WebhookEvent model has no explicit failure
 * tracking. Events that throw during processing remain with `processedAt: null`
 * and are counted as `pending` (they will be retried on the next batch).
 */
export async function getQueueStats(workspaceId: string): Promise<QueueStats> {
  const [pending, processed, oldestPending] = await Promise.all([
    db.webhookEvent.count({ where: { workspaceId, processedAt: null } }),
    db.webhookEvent.count({ where: { workspaceId, processedAt: { not: null } } }),
    db.webhookEvent.findFirst({
      where: { workspaceId, processedAt: null },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ])

  return {
    pending,
    processed,
    failed: 0,
    oldestPendingAt: oldestPending?.createdAt ?? null,
  }
}

/**
 * Process up to `limit` pending events for a workspace, oldest first.
 *
 * Each event is processed via `processLead`. Failures are logged and counted
 * but do not stop the batch — the event remains with `processedAt: null` so
 * it can be retried. Returns the number of successfully processed and failed
 * events.
 */
export async function processBatch(workspaceId: string, limit = 50): Promise<BatchResult> {
  const events = await db.webhookEvent.findMany({
    where: { workspaceId, processedAt: null },
    take: limit,
    orderBy: { createdAt: "asc" },
  })

  let processed = 0
  let failed = 0

  for (const event of events) {
    try {
      await processLead({
        workspaceId: event.workspaceId!,
        source: event.source,
        payload: event.payload,
      })
      processed++
    } catch (err) {
      console.error(`[queue] event ${event.id} failed`, err instanceof Error ? err.message : err)
      failed++
    }
  }

  return { processed, failed }
}
