import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { processLead } from "@/modules/leadIngest/worker"

export const dynamic = "force-dynamic"

type RouteParams = { source: string } | Promise<{ source: string }>

const KNOWN_SOURCES = new Set([
  "ninety_nine_acres", "99acres", "magic_bricks", "magicbricks", "housing",
  "nobroker", "meta", "facebook", "google", "website", "walk_in", "pabbly",
])

async function resolveSource(params: RouteParams): Promise<string> {
  const r = await params
  return (r?.source ?? "").toLowerCase().trim()
}

/**
 * Thin lead ingress. Verifies source + resolves workspace, then materializes
 * the lead. Always returns 200 after basic validation so the portal never
 * retries into a storm; failures are recorded on WebhookEvent for replay.
 * Workspace resolved via ?workspace=<slug> (portals configure per-tenant URL).
 */
export async function POST(req: Request, { params }: { params: RouteParams }) {
  const source = await resolveSource(params)
  if (!KNOWN_SOURCES.has(source)) {
    return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 })
  }

  const url = new URL(req.url)
  const slug = url.searchParams.get("workspace") ?? url.searchParams.get("w")
  if (!slug) {
    return NextResponse.json({ error: "Missing ?workspace=<slug>" }, { status: 400 })
  }

  let body: unknown = {}
  try {
    const raw = await req.text()
    body = raw ? JSON.parse(raw) : {}
  } catch {
    body = {}
  }

  const ws = await db.workspace.findUnique({ where: { slug }, select: { id: true } })
  if (!ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  }

  try {
    const result = await processLead({ workspaceId: ws.id, source, payload: body })
    return NextResponse.json({ received: true, ...result }, { status: 200 })
  } catch (e) {
    console.error(`[webhook:leads:${source}] process error`, e)
    // Ingress stays 200 — WebhookEvent row holds FAILED status for replay.
    return NextResponse.json({ received: true, queued: false, note: "recorded for replay" }, { status: 200 })
  }
}
