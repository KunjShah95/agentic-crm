import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { dpdpExport } from "@/modules/compliance/export"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const slug = url.searchParams.get("workspace") ?? ""
  if (!slug) return NextResponse.json({ error: "Missing ?workspace" }, { status: 400 })
  const ws = await db.workspace.findUnique({ where: { slug }, select: { id: true } })
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const csv = await dpdpExport(ws.id)
  return new Response(csv, { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="dpdp-${slug}.csv"` } })
}
