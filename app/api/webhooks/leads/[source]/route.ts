import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { processLead } from "@/modules/leadIngest/worker"
import { requireIngressAuth } from "@/modules/leadIngest/ingress"
import { hitRateLimit, getClientIp } from "@/modules/web-contact/rate-limit"

export const dynamic = "force-dynamic"

/**
 * Next 16 hands route params in as a Promise, and its generated route types
 * require it: `ParamCheck<RouteContext>` is only satisfied when `params` is
 * assignable to `Promise<any>`.
 *
 * This was `{ source: string } | Promise<{ source: string }>` — a union written to
 * be liberal about what callers might pass. Runtime-wise `await` handles both, so
 * it worked; but the union is not assignable to `Promise<any>`, so it fails the
 * generated check, and `npm run build` does not complete.
 *
 * Worth naming because the union reads as robustness and is actually the opposite:
 * it turns a framework invariant off rather than satisfying it. The same shape
 * appears in `modules/rag/validation.ts`, where `z.string().uuid().or(z.string().min(1))`
 * validated nothing for the same reason.
 *
 * A one-line signature, so the build gate that would have caught it can exist.
 */
type RouteParams = Promise<{ source: string }>

const KNOWN_SOURCES = new Set([
  "ninety_nine_acres", "99acres", "magic_bricks", "magicbricks", "housing",
  "nobroker", "meta", "facebook", "google", "website", "walk_in", "pabbly",
])

async function resolveSource(params: RouteParams): Promise<string> {
  const r = await params
  return (r?.source ?? "").toLowerCase().trim()
}

/**
 * Lead ingress for server-to-server callers (Meta lead forms, portal
 * exporters, Zapier). Authenticated, rate limited, workspace-resolved, then
 * materializes the lead.
 *
 * The workspace slug in the query is a routing hint, not a credential — it is
 * visible in public micro-site URLs. The `x-estate360-ingest-key` header is
 * the credential, checked before anything is written. See `./ingress`.
 *
 * After basic validation this always returns 200 so the portal never retries
 * into a storm; failures are recorded on WebhookEvent for replay. Auth and rate
 * limit failures are the exception — they return their own status so a
 * misconfigured integration is visible instead of silently swallowed.
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

  const ws = await db.workspace.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (!ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  }

  // Per-IP limit first: it must run before the credential check, so an
  // anonymous caller cannot use the endpoint as a hash oracle, and it bounds
  // the DB work they can cause.
  const ipLimit = await hitRateLimit(`leads:ip:${getClientIp(req.headers)}`, {
    max: 120,
    windowMs: 60_000,
  })
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Too many lead webhook requests" },
      { status: 429, headers: { "retry-after": String(ipLimit.retryAfterSec) } }
    )
  }

  // Per workspace+source, so one misconfigured portal retry loop cannot exhaust
  // every other source's budget.
  const wsLimit = await hitRateLimit(`leads:ws:${ws.id}:${source}`, {
    max: 600,
    windowMs: 60_000,
  })
  if (!wsLimit.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded for source ${source}` },
      { status: 429, headers: { "retry-after": String(wsLimit.retryAfterSec) } }
    )
  }

  const auth = await requireIngressAuth(req, ws.id)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: unknown = {}
  try {
    const raw = await req.text()
    body = raw ? JSON.parse(raw) : {}
  } catch {
    body = {}
  }

  try {
    // Ingress was authenticated, so this lead may trigger the workspace's
    // opted-in WhatsApp auto-ack.
    const result = await processLead({
      workspaceId: ws.id,
      source,
      payload: body,
      trusted: true,
    })
    return NextResponse.json({ received: true, ...result }, { status: 200 })
  } catch (e) {
    console.error(`[webhook:leads:${source}] process error`, e)
    // Ingress stays 200 — WebhookEvent row holds FAILED status for replay.
    return NextResponse.json({ received: true, queued: false, note: "recorded for replay" }, { status: 200 })
  }
}