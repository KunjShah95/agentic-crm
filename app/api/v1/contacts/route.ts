import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyApiKey } from "@/modules/platform/apiKeys"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceSlug = url.searchParams.get("workspace") ?? ""
  const key = req.headers.get("x-api-key") ?? url.searchParams.get("key") ?? ""
  if (!workspaceSlug || !key) return NextResponse.json({ error: "Missing workspace/key" }, { status: 401 })
  const ws = await db.workspace.findUnique({ where: { slug: workspaceSlug }, select: { id: true } })
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  const ok = await verifyApiKey(ws.id, key)
  if (!ok) return NextResponse.json({ error: "Invalid key" }, { status: 401 })
  const contacts = await db.contact.findMany({ where: { workspaceId: ws.id }, take: 20, orderBy: { createdAt: "desc" }, select: { id: true, firstName: true, lastName: true, email: true, leadSource: true } })
  return NextResponse.json({ contacts })
}
