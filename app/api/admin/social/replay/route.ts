import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { getQueue } from "@/modules/social/queue"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/social/replay
 * ADMIN-gated: re-queues a SocialEvent from DLQ for reprocessing.
 * Body: { eventId: string, workspaceId?: string }
 */
export async function POST(req: Request) {
  const session = await auth()
  const userId = (session?.user as unknown as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const eventId = (body.eventId ?? body.id) as string | undefined
  let workspaceId = body.workspaceId as string | undefined

  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 })
  }

  type ReplayEvent = { id: string; workspaceId: string; provider: string; type: string; payload: unknown }
  let event: ReplayEvent | null = null
  try {
    event = (await db.socialEvent.findUnique({ where: { id: eventId } }) as unknown) as ReplayEvent | null
  } catch {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  const resolvedWorkspaceId = workspaceId ?? event.workspaceId
  if (!resolvedWorkspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 })
  }

  // ADMIN gate — requireWorkspaceMember with ADMIN
  try {
    await requireWorkspaceMember(resolvedWorkspaceId, userId, "ADMIN")
  } catch (e) {
    const msg = (e as Error).message
    const status = (e as { status?: number }).status ?? 403
    return NextResponse.json({ error: msg }, { status })
  }

  // Build normalized payload for re-queue
  const raw = event.payload
  let normalized: { externalId: string; type: string; from: { handle: string; displayName?: string }; body: string; timestamp: string }

  // Try to extract fields from raw if it looks like stored normalized/payload
  const rawObj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null
  if (rawObj) {
    const fromHandle =
      (rawObj["fromHandle"] as string | undefined) ??
      (rawObj["from"] as string | undefined) ??
      ((rawObj["from"] as Record<string, unknown> | undefined)?.["handle"] as string | undefined) ??
      "replay"
    const bodyText = (rawObj["body"] as string | undefined) ?? (rawObj["text"] as string | undefined) ?? JSON.stringify(raw).slice(0, 2000)
    const typeVal = event.type ?? "message"
    normalized = {
      externalId: event.id,
      type: typeVal,
      from: { handle: String(fromHandle) },
      body: String(bodyText).slice(0, 4000),
      timestamp: new Date().toISOString(),
    }
  } else {
    normalized = {
      externalId: event.id,
      type: event.type ?? "message",
      from: { handle: "replay" },
      body: typeof raw === "string" ? raw.slice(0, 4000) : JSON.stringify(raw).slice(0, 4000),
      timestamp: new Date().toISOString(),
    }
  }

  try {
    const queue = getQueue()
    const jobId = `${event.provider}:${event.id}:replay:${Date.now()}`
    await queue.add(
      "social-ingest",
      { provider: event.provider, normalized, raw },
      {
        jobId,
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
      }
    )

    // Clear processedAt so ingest can reprocess (DLQ events were failed after 5 attempts; may not have been marked processed)
    try {
      await db.socialEvent.update({ where: { id: event.id }, data: { processedAt: null } })
    } catch {
      // ignore if no processedAt field or already null
    }

    // Remove from in-memory DLQ tracking if present
    try {
      const { _removeFromDLQForTests } = await import("@/modules/social/queue")
      if (typeof _removeFromDLQForTests === "function") {
        _removeFromDLQForTests(event.id)
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, requeued: event.id, jobId })
  } catch (e) {
    console.error("[admin replay] queue error", e)
    return NextResponse.json({ error: "Queue error" }, { status: 500 })
  }
}
