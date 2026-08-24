import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { decrypt, encrypt } from "@/modules/social/connections"
import { getProvider } from "@/modules/social/provider"

export const dynamic = "force-dynamic"

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // No secret configured -> allow in non-production, deny in prod
    if (process.env.NODE_ENV === "production") return false
    return true
  }
  const headers = req.headers
  const auth = headers.get("authorization") ?? headers.get("Authorization") ?? ""
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : auth
  const candidates = [
    bearer,
    headers.get("x-cron-secret"),
    headers.get("x-cron_secret"),
    headers.get("cron-secret"),
    headers.get("x-vercel-cron-secret"),
    // also check lowercase variants explicitly
    headers.get("X-CRON-SECRET"),
  ].filter(Boolean) as string[]

  return candidates.some((v) => v === secret)
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 })
  }

  const now = new Date()
  const threshold = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now

  let connections: Awaited<ReturnType<typeof db.socialConnection.findMany>>
  try {
    connections = await db.socialConnection.findMany({
      where: {
        expiresAt: { lt: threshold },
        // skip already marked needs_reauth; also allow null expiresAt? spec says where expiresAt < now+1h
        // if expiresAt is null we skip (no expiry)
      },
    })
  } catch (e) {
    console.error("[cron refresh] db query failed", e)
    return NextResponse.json({ error: "db error" }, { status: 500 })
  }

  // Filter out connections without expiresAt (already excluded by lt, but prisma may include null? no, lt excludes null)
  // Also filter out needs_reauth to avoid retry loop
  const toRefresh = connections.filter((c) => c.status !== "needs_reauth")

  let refreshed = 0
  let failed = 0
  let skipped = 0
  const errors: Array<{ id: string; provider: string; error: string }> = []

  for (const conn of toRefresh) {
    // If no refresh token, cannot refresh -> mark needs_reauth
    if (!conn.refreshTokenEnc) {
      skipped++
      continue
    }

    let refreshToken: string
    try {
      refreshToken = decrypt(conn.refreshTokenEnc)
    } catch (e) {
      console.error(`[cron refresh] decrypt failed for ${conn.id}`, e)
      await db.socialConnection.update({
        where: { id: conn.id },
        data: { status: "needs_reauth" },
      })
      failed++
      errors.push({ id: conn.id, provider: conn.provider, error: "decrypt_failed" })
      continue
    }

    try {
      const provider = getProvider(conn.provider)
      const result = await provider.refresh(refreshToken)

      const data: Record<string, unknown> = {
        accessTokenEnc: encrypt(result.accessToken),
        status: "active",
        lastSyncAt: new Date(),
      }
      if (result.refreshToken) {
        data.refreshTokenEnc = encrypt(result.refreshToken)
      }
      if (result.expiresAt) {
        data.expiresAt = result.expiresAt
      }

      await db.socialConnection.update({
        where: { id: conn.id },
        data,
      })
      refreshed++
    } catch (e) {
      console.error(`[cron refresh] refresh failed for ${conn.id} (${conn.provider})`, e)
      try {
        await db.socialConnection.update({
          where: { id: conn.id },
          data: { status: "needs_reauth" },
        })
      } catch {
        // ignore secondary error
      }
      failed++
      errors.push({
        id: conn.id,
        provider: conn.provider,
        error: (e as Error).message?.slice(0, 200) ?? "refresh_failed",
      })
    }
  }

  return NextResponse.json({
    ok: true,
    checked: toRefresh.length,
    refreshed,
    failed,
    skipped,
    threshold: threshold.toISOString(),
    errors: errors.length ? errors : undefined,
  })
}

// Allow POST as well for manual trigger via Vercel cron (some use POST)
export async function POST(req: Request) {
  return GET(req)
}
