import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyApiKey } from "@/modules/platform/apiKeys";
import { bulkIngestDocuments } from "@/modules/rag/ingest";
import { bulkIngestSchema } from "@/modules/rag/validation";
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

// POST /api/v1/tenants/:tenantId/rag/bulk - Bulk ingest documents
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const auth = await verifyWorkspace(req, tenantId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const parsed = bulkIngestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const data = await bulkIngestDocuments({
      tenantId: auth.workspaceId,
      userId: "api-user",
      items: parsed.data.items,
    });

    return NextResponse.json({ success: true, data }, { status: 202 });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("RAG bulk ingest error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}