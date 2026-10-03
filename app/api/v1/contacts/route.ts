import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyApiKey } from "@/modules/platform/apiKeys"
import { hitRateLimit } from "@/modules/web-contact/rate-limit"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceSlug = url.searchParams.get("workspace") ?? ""
  const key = req.headers.get("x-api-key") ?? url.searchParams.get("key") ?? ""
  if (!workspaceSlug || !key) return NextResponse.json({ error: "Missing workspace/key" }, { status: 401 })
  const ws = await db.workspace.findUnique({ where: { slug: workspaceSlug }, select: { id: true } })
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  const ok = await verifyApiKey(ws.id, key)
  if (!ok) return NextResponse.json({ error: "Invalid key" }, { status: 401 })

  // Per-key, so one noisy integration cannot exhaust the tenant's own quota.
  const limit = await hitRateLimit(`v1:${ws.id}`, { max: 120, windowMs: 60_000 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } }
    )
  }

  const contacts = await db.contact.findMany({ where: { workspaceId: ws.id }, take: 20, orderBy: { createdAt: "desc" }, select: { id: true, firstName: true, lastName: true, email: true, leadSource: true } })
  return NextResponse.json({ contacts })
}
