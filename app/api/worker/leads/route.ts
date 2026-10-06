import { NextResponse } from "next/server"
import crypto from "crypto"
import { processBatch, getQueueStats } from "@/modules/leadIngest/queue"

export const dynamic = "force-dynamic"

/**
 * Worker endpoint for async lead processing.
 *
 * Called by a cron job (Vercel Cron, OCI scheduler, etc.) to drain the
 * WebhookEvent queue. Protected by a shared secret header.
 *
 * POST /api/worker/leads
 * Headers: x-estate360-worker-key: <WORKER_SECRET>
 * Body: { workspaceId: string, limit?: number }
 *
 * Returns { processed, failed, remaining }.
 */

function authorized(req: Request): boolean {
  const secret = process.env.WORKER_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === "production") return false
    return true
  }
  const header = req.headers.get("x-estate360-worker-key") ?? ""
  const a = Buffer.from(header)
  const b = Buffer.from(secret)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: { workspaceId?: string; limit?: number } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { workspaceId } = body
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 })
  }

  const limit = body.limit ?? 50
  const result = await processBatch(workspaceId, limit)
  const stats = await getQueueStats(workspaceId)

  return NextResponse.json({
    processed: result.processed,
    failed: result.failed,
    remaining: stats.pending,
  })
}
