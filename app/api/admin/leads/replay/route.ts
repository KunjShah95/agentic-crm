import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { requireWorkspaceMember } from "@/lib/permissions"
import { replayPending } from "@/worker/replay"

export const dynamic = "force-dynamic"

/**
 * Admin-only replay of unprocessed lead webhooks for a workspace. Reprocesses
 * WebhookEvent rows where processedAt is null (idempotent on dedupeKey).
 * POST /api/admin/leads/replay?workspace=<slug>&limit=50
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const slug = url.searchParams.get("workspace") ?? url.searchParams.get("w")
  if (!slug) {
    return NextResponse.json({ error: "Missing ?workspace=<slug>" }, { status: 400 })
  }

  const ws = await db.workspace.findUnique({ where: { slug }, select: { id: true } })
  if (!ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  }

  try {
    await requireWorkspaceMember(ws.id, session.user.id, "ADMIN")
  } catch {
    return NextResponse.json({ error: "Forbidden — ADMIN role required" }, { status: 403 })
  }

  const limitParam = Number(url.searchParams.get("limit"))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50

  const result = await replayPending({ workspaceId: ws.id, limit })
  return NextResponse.json(result, { status: 200 })
}
