import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

const RAG_EVENTS = ["RAG_DOCS", "RAG_QUERIES"] as const;

export async function assertQuota({ tenantId, event }: { tenantId: string; event: (typeof RAG_EVENTS)[number] }) {
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

export async function recordUsage({ tenantId, userId, event }: { tenantId: string; userId: string; event: (typeof RAG_EVENTS)[number] }) {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  await db.usageCounter.upsert({
    where: { workspaceId_kind_period: { workspaceId: tenantId, kind: event, period } },
    create: { workspaceId: tenantId, kind: event, period, count: 1 },
    update: { count: { increment: 1 } },
  });
  // Also record usage event for audit
  await db.usageEvent.create({ data: { workspaceId: tenantId, kind: event, count: 1 } });
}