/**
 * Observability metrics for the lead ingest pipeline.
 *
 * Provides two metric families:
 *   - IngestMetrics: queue health, dedupe rate, score distribution, source breakdown
 *   - AIMetrics: agent-scheduled follow-ups, auto-ack delivery stats
 *
 * All functions are workspace-scoped and read-only.
 */

import { db } from "@/lib/db"

export type IngestMetrics = {
  totalEvents: number
  pendingEvents: number
  processedEvents: number
  dedupeRate: number
  scoreDistribution: {
    hot: number
    warm: number
    cold: number
  }
  oldestPendingAt: Date | null
  eventsLast24h: number
  sourcesBreakdown: Record<string, number>
}

export type AIMetrics = {
  followUpsScheduled: number
  actionsByType: {
    CALL: number
    TASK: number
    NOTE: number
  }
  autoAckSent: number
  autoAckFailed: number
}

/**
 * Get ingest pipeline metrics for a workspace.
 *
 * Returns queue health, dedupe rate, lead score distribution, and source
 * breakdown for the last 24 hours.
 */
export async function getIngestMetrics(workspaceId: string): Promise<IngestMetrics> {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    totalEvents,
    pendingEvents,
    processedEvents,
    oldestPending,
    eventsLast24h,
    sourcesBreakdown,
    contacts,
  ] = await Promise.all([
    db.webhookEvent.count({ where: { workspaceId } }),
    db.webhookEvent.count({ where: { workspaceId, processedAt: null } }),
    db.webhookEvent.count({ where: { workspaceId, processedAt: { not: null } } }),
    db.webhookEvent.findFirst({
      where: { workspaceId, processedAt: null },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    db.webhookEvent.count({
      where: { workspaceId, createdAt: { gte: last24h } },
    }),
    db.webhookEvent.groupBy({
      by: ["source"],
      where: { workspaceId, createdAt: { gte: last24h } },
      _count: { _all: true },
    }),
    db.contact.findMany({
      where: { workspaceId },
      select: { leadScore: true },
    }),
  ])

  // Score distribution: hot (70+), warm (40-69), cold (0-39)
  let hot = 0
  let warm = 0
  let cold = 0
  for (const contact of contacts) {
    const score = contact.leadScore ?? 0
    if (score >= 70) hot++
    else if (score >= 40) warm++
    else cold++
  }

  // Dedupe rate: percentage of events that were deduped.
  // The WebhookEvent model does not track dedupe hits explicitly, so we
  // infer from the payload. If the payload contains a `deduped: true` flag
  // (set by the webhook handler), we count it. Otherwise the rate is 0.
  const dedupedCount = await db.webhookEvent.count({
    where: {
      workspaceId,
      payload: { path: ["deduped"], equals: true },
    },
  })
  const dedupeRate = totalEvents > 0 ? (dedupedCount / totalEvents) * 100 : 0

  const sourcesMap: Record<string, number> = {}
  for (const row of sourcesBreakdown) {
    sourcesMap[row.source] = row._count._all
  }

  return {
    totalEvents,
    pendingEvents,
    processedEvents,
    dedupeRate,
    scoreDistribution: { hot, warm, cold },
    oldestPendingAt: oldestPending?.createdAt ?? null,
    eventsLast24h,
    sourcesBreakdown: sourcesMap,
  }
}

/**
 * Get AI agent metrics for a workspace.
 *
 * Returns agent-scheduled follow-up counts, breakdown by activity type,
 * and WhatsApp auto-ack delivery stats for the last 7 days.
 */
export async function getAIMetrics(workspaceId: string): Promise<AIMetrics> {
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [followUpsScheduled, actionsByType, autoAckSent, autoAckFailed] = await Promise.all([
    db.activity.count({
      where: {
        workspaceId,
        source: "agent",
        createdAt: { gte: last7d },
      },
    }),
    db.activity.groupBy({
      by: ["type"],
      where: {
        workspaceId,
        source: "agent",
        createdAt: { gte: last7d },
      },
      _count: { _all: true },
    }),
    db.activity.count({
      where: {
        workspaceId,
        source: "agent",
        createdAt: { gte: last7d },
        type: "NOTE",
        body: { contains: "auto-ack" },
        status: "sent",
      },
    }),
    db.activity.count({
      where: {
        workspaceId,
        source: "agent",
        createdAt: { gte: last7d },
        type: "NOTE",
        body: { contains: "auto-ack" },
        status: "failed",
      },
    }),
  ])

  const actionsMap: Record<string, number> = { CALL: 0, TASK: 0, NOTE: 0 }
  for (const row of actionsByType) {
    actionsMap[row.type] = row._count._all
  }

  return {
    followUpsScheduled,
    actionsByType: {
      CALL: actionsMap.CALL ?? 0,
      TASK: actionsMap.TASK ?? 0,
      NOTE: actionsMap.NOTE ?? 0,
    },
    autoAckSent,
    autoAckFailed,
  }
}
