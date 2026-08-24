import { NextResponse } from "next/server"
import { getProvider } from "@/modules/social/provider"
import { getQueue } from "@/modules/social/queue"
import { createXResponseToken } from "@/modules/social/providers/x"

export const dynamic = "force-dynamic"

// Next.js 15: params is a Promise in App Router
type RouteParams = { provider: string } | Promise<{ provider: string }>

async function resolveProviderParam(params: RouteParams): Promise<string> {
  const resolved = await params
  return (resolved?.provider ?? "").toLowerCase().trim()
}

function headersToRecord(req: Request): Record<string, string> {
  const out: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    out[k] = v
    out[k.toLowerCase()] = v
  })
  return out
}

function queryToRecord(url: URL): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {}
  url.searchParams.forEach((v, k) => {
    const existing = out[k]
    if (existing === undefined) out[k] = v
    else if (Array.isArray(existing)) existing.push(v)
    else out[k] = [existing as string, v]
  })
  // also include lowercase aliases for convenience
  for (const [k, v] of Object.entries({ ...out })) {
    const lower = k.toLowerCase()
    if (lower !== k && out[lower] === undefined) out[lower] = v
  }
  return out
}

/**
 * GET — handles verification challenges:
 * - X CRC: ?crc_token=xxx -> returns {response_token: `sha256=...`}
 * - WhatsApp hub.verify_token: ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=... -> returns challenge
 * - Unipile / generic: 200 if verifyWebhook passes
 */
export async function GET(req: Request, { params }: { params: RouteParams }) {
  const providerName = await resolveProviderParam(params as RouteParams)

  let provider
  try {
    provider = getProvider(providerName)
  } catch {
    return NextResponse.json({ error: `Unknown provider: ${providerName}` }, { status: 400 })
  }

  const url = new URL(req.url)
  const query = queryToRecord(url)
  const headers = headersToRecord(req)

  // Use rawBody empty for GET; body undefined
  let verified: boolean
  try {
    const res = provider.verifyWebhook({ headers, query, body: undefined, rawBody: "" })
    verified = res instanceof Promise ? await res : res
  } catch {
    verified = false
  }

  // X CRC challenge — respond with response_token if crc_token present
  const crcToken =
    (query["crc_token"] as string | undefined) ??
    (query["crcToken"] as string | undefined)
  if (crcToken) {
    if (!verified) {
      // If verify failed but secret missing? For X, if no secret configured, treat as verifiable in dev
      // But for security, return 401 if signature header present and invalid
      const hasSig = headers["x-twitter-webhooks-signature"] || headers["x_twitter_webhooks_signature"]
      if (hasSig) return new Response("Unauthorized", { status: 401 })
    }
    try {
      const response_token = createXResponseToken(crcToken)
      return NextResponse.json({ response_token })
    } catch {
      // No secret configured — return 400 for CRC request without secret in prod
      if (process.env.NODE_ENV === "production") {
        return new Response("Webhook secret not configured", { status: 500 })
      }
      return NextResponse.json({ response_token: `sha256=${crcToken}` })
    }
  }

  // WhatsApp hub verification — if query contains hub.challenge and verified, echo it
  const hubChallenge = query["hub.challenge"] as string | undefined
  const hubMode = query["hub.mode"] as string | string[] | undefined
  if (hubChallenge !== undefined) {
    const modeVal = Array.isArray(hubMode) ? hubMode[0] : (hubMode as string | undefined)
    // If mode is subscribe and verified, return challenge plaintext (per Meta spec)
    if (verified && modeVal === "subscribe") {
      const challengeVal = Array.isArray(hubChallenge) ? hubChallenge[0] : hubChallenge
      return new Response(challengeVal, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })
    }
    if (!verified) return new Response("Forbidden", { status: 403 })
    // Fallback: return challenge even if mode missing but verified
    const challengeVal = Array.isArray(hubChallenge) ? hubChallenge[0] : hubChallenge
    return new Response(challengeVal, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })
  }

  if (!verified) {
    // For LinkedIn/unipile: verifyUnipileWebhook returns true when no secret configured (dev open) — so this will pass
    // For others without challenge, require verification
    const hasAnySecret =
      process.env.X_CONSUMER_SECRET ||
      process.env.X_CLIENT_SECRET ||
      process.env.WHATSAPP_APP_SECRET ||
      process.env.UNIPILE_WEBHOOK_SECRET
    // In dev without secrets, allow GET to pass for smoke tests; in prod fail-closed
    if (process.env.NODE_ENV === "production" && hasAnySecret) {
      return new Response("Unauthorized", { status: 401 })
    }
    // For safety, if no secret configured and no challenge, just return 200 (thin ingress open in dev)
    if (!hasAnySecret) return NextResponse.json({ ok: true, verified: false, provider: providerName })
    return new Response("Unauthorized", { status: 401 })
  }

  return NextResponse.json({ ok: true, provider: providerName })
}

export async function POST(req: Request, { params }: { params: RouteParams }) {
  const providerName = await resolveProviderParam(params as RouteParams)

  let provider
  try {
    provider = getProvider(providerName)
  } catch {
    return NextResponse.json({ error: `Unknown provider: ${providerName}` }, { status: 400 })
  }

  const url = new URL(req.url)
  const query = queryToRecord(url)
  const headers = headersToRecord(req)

  let rawBody = ""
  try {
    rawBody = await req.text()
  } catch {
    rawBody = ""
  }

  let body: unknown = undefined
  if (rawBody) {
    try {
      body = JSON.parse(rawBody)
    } catch {
      body = rawBody
    }
  }

  // Verify webhook signature using timingSafeEqual inside provider
  let verified: boolean
  try {
    const res = provider.verifyWebhook({ headers, query, body, rawBody })
    verified = res instanceof Promise ? await res : res
  } catch (e) {
    console.error(`[webhook:${providerName}] verify error`, e)
    verified = false
  }

  if (!verified) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Normalize payload
  let normalized
  try {
    const payload = body !== undefined ? body : {}
    normalized = provider.normalize(payload)
  } catch (e) {
    console.error(`[webhook:${providerName}] normalize error`, e)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  if (!normalized?.externalId) {
    return NextResponse.json({ error: "Missing externalId after normalization" }, { status: 400 })
  }

  // Queue thin ingress — dedupe via jobId = provider:externalId
  const jobId = `${providerName}:${normalized.externalId}`
  try {
    const queue = getQueue()
    await queue.add(
      "social-ingest",
      {
        provider: providerName,
        normalized,
        raw: body,
      },
      {
        jobId,
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
      }
    )
  } catch (e) {
    console.error(`[webhook:${providerName}] queue error`, e)
    return NextResponse.json({ error: "Queue error" }, { status: 500 })
  }

  return NextResponse.json({ received: true, id: normalized.externalId, jobId }, { status: 200 })
}
