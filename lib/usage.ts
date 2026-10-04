import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/**
 * The quota-tracked RAG events.
 *
 * A union rather than `const RAG_EVENTS = [...] as const` because the array was
 * only ever read through `typeof RAG_EVENTS[number]` — it existed at runtime so
 * that a type could be derived from it, which allocated a two-element array on
 * every module load to serve a type-level need. Exported because it names the
 * two events the quota logic branches on, which is worth having in one place.
 */
export type RagEvent = "RAG_DOCS" | "RAG_QUERIES";

export async function assertQuota({ tenantId, event }: { tenantId: string; event: RagEvent }) {
  // For RAG events, we use a simple quota check
  // In production, this could be expanded to check workspace-specific limits
  const ws = await db.workspace.findUnique({ where: { id: tenantId }, select: { plan: true } });
  if (!ws) throw new AppError("NOT_FOUND", "Workspace not found", 404);
  
  // Simple plan-based limits
  const limits: Record<string, { docs: number; queries: number }> = {
    free: { docs: 100, queries: 500 },
    pro: { docs: 5000, queries: 25000 },
    enterprise: { docs: 50000, queries: 250000 },
  };
  
  const limit = limits[ws.plan]?.docs || limits.free.docs;
  if (event === "RAG_QUERIES") {
    const queryLimit = limits[ws.plan]?.queries || limits.free.queries;
    // Check current usage for queries
    const counter = await db.usageCounter.findUnique({
      where: { workspaceId_kind_period: { workspaceId: tenantId, kind: "RAG_QUERIES", period: new Date().toISOString().slice(0, 7) } },
    });
    if (counter && counter.count >= queryLimit) {
      throw new AppError("QUOTA_EXCEEDED", "RAG query quota exceeded", 402);
    }
  } else {
    const counter = await db.usageCounter.findUnique({
      where: { workspaceId_kind_period: { workspaceId: tenantId, kind: "RAG_DOCS", period: new Date().toISOString().slice(0, 7) } },
    });
    if (counter && counter.count >= limit) {
      throw new AppError("QUOTA_EXCEEDED", "RAG document quota exceeded", 402);
    }
  }
}

export async function recordUsage({ tenantId, userId, event }: { tenantId: string; userId: string; event: RagEvent }) {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  await db.usageCounter.upsert({
    where: { workspaceId_kind_period: { workspaceId: tenantId, kind: event, period } },
    create: { workspaceId: tenantId, kind: event, period, count: 1 },
    update: { count: { increment: 1 } },
  });
  /* Also record usage event for audit.

     `userId` was destructured and then never written: `UsageEvent` has no
     `userId` column, so every caller — RAG ingest, RAG query, and the rest —
     passed the id of the user who triggered the event and it was dropped. That
     left an "audit" trail with no actor on it, which cannot answer the only
     question an audit is for.

     Recorded under the existing `meta` Json column rather than by adding a
     `userId` column, since that needs a migration and `meta` is what it is
     there for. Left out entirely if there is no authenticated user — some
     paths record usage from a background job, and writing a null actor there is
     accurate rather than a gap. */
  await db.usageEvent.create({
    data: {
      workspaceId: tenantId,
      kind: event,
      count: 1,
      meta: userId ? { userId } : undefined,
    },
  });
}