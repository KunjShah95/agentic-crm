import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyApiKey } from "@/modules/platform/apiKeys";
import { ingestDocument } from "@/modules/rag/ingest";
import { listDocuments } from "@/modules/rag/ingest";
import { AppError } from "@/lib/errors";
import { ingestSchema } from "@/modules/rag/validation";

// Helper to verify API key and get workspace
async function verifyWorkspace(req: NextRequest, tenantId: string) {
  const key = req.headers.get("x-api-key") || "";
  if (!key) return { error: "Missing API key", status: 401 as const };
  
  const ws = await db.workspace.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!ws) return { error: "Workspace not found", status: 404 as const };
  
  const ok = await verifyApiKey(ws.id, key);
  if (!ok) return { error: "Invalid API key", status: 401 as const };
  
  return { workspaceId: ws.id };
}

// Helper to build file-like object from JSON body
function fileFromBody(body: {
  text?: string;
  contentBase64?: string;
  filename?: string;
  mime?: string;
  title?: string;
}) {
  if (body.text) {
    const buffer = Buffer.from(body.text, "utf8");
    return {
      buffer,
      originalname: body.filename || body.title || "note.txt",
      mimetype: body.mime || "text/plain",
      size: buffer.length,
    };
  }
  const buffer = Buffer.from(body.contentBase64 || "", "base64");
  return {
    buffer,
    originalname: body.filename || body.title || "upload.bin",
    mimetype: body.mime || "application/octet-stream",
    size: buffer.length,
  };
}

// POST /api/v1/tenants/:tenantId/rag/documents - Ingest document
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const auth = await verifyWorkspace(req, tenantId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const parsed = ingestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const file = fileFromBody(body);
    const data = await ingestDocument({
      tenantId: auth.workspaceId,
      userId: "api-user",
      file,
      title: parsed.data.title,
      externalId: parsed.data.externalId,
      department: parsed.data.department || "general",
      docType: parsed.data.docType || null,
      tags: parsed.data.tags || [],
      authority: parsed.data.authority ?? 1.0,
      confidential: parsed.data.confidential || false,
      allowedRoles: parsed.data.allowedRoles || [],
    });

    return NextResponse.json({ success: true, data }, { status: 202 });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("RAG ingest error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/v1/tenants/:tenantId/rag/documents - List documents
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const auth = await verifyWorkspace(req, tenantId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const data = await listDocuments({ tenantId: auth.workspaceId });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("RAG list error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}