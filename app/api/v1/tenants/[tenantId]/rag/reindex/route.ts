import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyApiKey } from "@/modules/platform/apiKeys";
import { reindexTenant } from "@/modules/rag/ingest";
import { stats } from "@/modules/rag/queue";
import { AppError } from "@/lib/errors";

async function verifyWorkspace(req: NextRequest, tenantId: string) {
  const key = req.headers.get("x-api-key") || "";
  if (!key) return { error: "Missing API key", status: 401 as const };
  
  const ws = await db.workspace.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!ws) return { error: "Workspace not found", status: 404 as const };
  
  const ok = await verifyApiKey(ws.id, key);
  if (!ok) return { error: "Invalid API key", status: 401 as const };
  
  return { workspaceId: ws.id };
}

// POST /api/v1/tenants/:tenantId/rag/reindex - Reindex tenant
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const auth = await verifyWorkspace(req, tenantId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const data = await reindexTenant({ tenantId: auth.workspaceId });
    const queueStats = stats();
    
    return NextResponse.json({ success: true, data: { ...data, queue: queueStats } });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("RAG reindex error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}