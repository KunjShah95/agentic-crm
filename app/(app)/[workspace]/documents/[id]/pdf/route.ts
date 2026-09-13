import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { htmlToPdf } from "@/lib/pdf"
import { documentPageHtml } from "@/modules/documents/render"

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ workspace: string; id: string }> },
) {
  const { workspace: slug, id } = await ctx.params

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: ws.id, userId: session.user.id } },
  })
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const doc = await db.generatedDocument.findFirst({
    where: { id, workspaceId: ws.id },
    select: { id: true, renderedHtml: true, template: { select: { name: true, kind: true } } },
  })
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })

  const title = doc.template?.name ?? "Document"
  const pdf = await htmlToPdf(documentPageHtml(doc.renderedHtml, title))
  const filename = `${(doc.template?.kind ?? "document").toLowerCase()}-${doc.id}.pdf`

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(pdf.length),
    },
  })
}
