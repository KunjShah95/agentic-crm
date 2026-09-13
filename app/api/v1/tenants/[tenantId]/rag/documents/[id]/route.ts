import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyApiKey } from "@/modules/platform/apiKeys";
import { getDocument, deleteDocument, reingestDocument } from "@/modules/rag/ingest";
import { ingestSchema } from "@/modules/rag/validation";
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

// GET /api/v1/tenants/:tenantId/rag/documents/:id - Get document
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string; id: string }> }) {
  try {
    const { tenantId, id } = await params;
    const auth = await verifyWorkspace(req, tenantId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const data = await getDocument({ tenantId: auth.workspaceId, documentId: id });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("RAG get error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/v1/tenants/:tenantId/rag/documents/:id - Re-ingest document (incremental by default)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ tenantId: string; id: string }> }) {
  try {
    const { tenantId, id } = await params;
    const auth = await verifyWorkspace(req, tenantId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const parsed = ingestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const file = fileFromBody(body);
    const mode = new URL(req.url).searchParams.get("mode") === "full" ? "full" : "incremental";

    const data = await reingestDocument({
      tenantId: auth.workspaceId,
      userId: "api-user",
      documentId: id,
      file,
      title: parsed.data.title,
      externalId: parsed.data.externalId,
      department: parsed.data.department,
      docType: parsed.data.docType,
      tags: parsed.data.tags,
      authority: parsed.data.authority,
      confidential: parsed.data.confidential,
      allowedRoles: parsed.data.allowedRoles,
      mode,
    });

    return NextResponse.json({ success: true, data }, { status: 202 });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("RAG reingest error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/v1/tenants/:tenantId/rag/documents/:id - Delete document
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tenantId: string; id: string }> }) {
  try {
    const { tenantId, id } = await params;
    const auth = await verifyWorkspace(req, tenantId);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const data = await deleteDocument({ tenantId: auth.workspaceId, documentId: id });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("RAG delete error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}