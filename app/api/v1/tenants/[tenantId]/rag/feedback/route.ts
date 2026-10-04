import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyApiKey } from "@/modules/platform/apiKeys";
import { submitFeedback, listFeedback } from "@/modules/rag/feedback";
import { feedbackSchema } from "@/modules/rag/validation";
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

// POST /api/v1/tenants/:tenantId/rag/feedback - Submit feedback
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const auth = await verifyWorkspace(req, tenantId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    /* `createdBy` is the literal "api-user" for every request.

       A workspace API key authenticates a *tenant*, not a person — `verifyApiKey`
       resolves to a workspace id and there is no per-principal identity on the
       credential — so there is no better value available here without changing the
       key model. Recorded rather than silently left, because it has a consequence
       worth knowing: `submitFeedback` also ingests any `correction` as a new
       document, and that document's author is this same string. So for corrections
       arriving through the API there is no record anywhere of which integration, or
       which person behind it, wrote a document that the corpus now treats as
       max-authority and cites to the whole workspace.

       Not fabricated into a plausible-looking id. An honest placeholder that is
       greppable beats a plausible value that reads as a real account. */
    const data = await submitFeedback({
      tenantId: auth.workspaceId,
      userId: "api-user",
      ...parsed.data,
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("RAG feedback error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/v1/tenants/:tenantId/rag/feedback - List feedback
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const auth = await verifyWorkspace(req, tenantId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const data = await listFeedback({ tenantId: auth.workspaceId });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("RAG feedback list error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}