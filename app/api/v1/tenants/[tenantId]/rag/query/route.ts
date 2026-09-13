import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyApiKey } from "@/modules/platform/apiKeys";
import { answerQuery } from "@/modules/rag/answer";
import { querySchema } from "@/modules/rag/validation";
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

// POST /api/v1/tenants/:tenantId/rag/query - Query the knowledge base
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const auth = await verifyWorkspace(req, tenantId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const parsed = querySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const data = await answerQuery({
      tenantId: auth.workspaceId,
      userId: "api-user",
      query: parsed.data.query,
      topK: parsed.data.topK,
      alpha: parsed.data.alpha,
      filter: {
        departments: parsed.data.departments,
        documentIds: parsed.data.documentIds,
        clause: parsed.data.clause,
        topK: parsed.data.topK,
      },
      role: null,
      context: parsed.data.context || null,
    });

    return NextResponse.json({ success: true, data });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("RAG query error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}