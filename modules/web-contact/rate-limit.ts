/**
 * Per-IP sliding rate limit for public web endpoints (contact form etc.).
 * Follows the modules/social/queue.ts pattern: Upstash REST → Redis → in-memory.
 * Throws RateLimitedError with retryAfter seconds when the limit is exceeded.
 */

export class RateLimitedError extends Error {
  retryAfterSec: number
  constructor(message: string, retryAfterSec: number) {
    super(message)
    this.name = "RateLimitedError"
    this.retryAfterSec = retryAfterSec
  }
}

type WindowState = { count: number; resetAt: number }

const memoryWindows = new Map<string, WindowState>()

export const CONTACT_FORM_WINDOW_MS = 60_000
export const CONTACT_FORM_MAX_PER_WINDOW = 5

/** Best-effort client IP from proxy headers (x-forwarded-for first hop wins). */
export function getClientIp(headers: { get(name: string): string | null }): string {
  const fwd = headers.get("x-forwarded-for")
  if (fwd) {
    const first = fwd.split(",")[0]?.trim()
    if (first) return first
  }
  return (
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-vercel-forwarded-for") ??
    "unknown"
  )
}

/**
 * Fixed-window counter per key. Returns seconds until the window resets.
 * Upstash REST is used when configured (works on serverless); otherwise falls
 * back to an in-process Map (fine for single-instance dev).
 */
export async function hitRateLimit(
  key: string,
  opts?: { windowMs?: number; max?: number }
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const windowMs = opts?.windowMs ?? CONTACT_FORM_WINDOW_MS
  const max = opts?.max ?? CONTACT_FORM_MAX_PER_WINDOW
  const bucket = `web-contact-rl:${key}`

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN
  if (upstashUrl && upstashToken) {
    try {
      const res = await fetch(`${upstashUrl}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${upstashToken}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", bucket],
          ["PTTL", bucket],
        ]),
      })
      if (res.ok) {
        const data = (await res.json()) as Array<{ result: number }>
        const count = data?.[0]?.result ?? 0
        const pttl = data?.[1]?.result ?? -1
        if (count === 1) {
          await fetch(`${upstashUrl}/pexpire`, {
            method: "POST",
            headers: { Authorization: `Bearer ${upstashToken}`, "Content-Type": "application/json" },
            body: JSON.stringify([bucket, windowMs]),
          })
        }
        if (count > max) {
          return { ok: false, retryAfterSec: pttl > 0 ? Math.ceil(pttl / 1000) : Math.ceil(windowMs / 1000) }
        }
        return { ok: true }
      }
    } catch (e) {
      console.warn("[web-contact rate-limit] Upstash REST failed, falling back to memory", (e as Error).message)
    }
  }

  // In-memory fallback (single instance)
  const now = Date.now()
  let state = memoryWindows.get(bucket)
  if (!state || now >= state.resetAt) {
    state = { count: 0, resetAt: now + windowMs }
    memoryWindows.set(bucket, state)
  }
  state.count += 1
  if (state.count > max) {
    return { ok: false, retryAfterSec: Math.ceil((state.resetAt - now) / 1000) }
  }
  // Opportunistic cleanup so the Map doesn't grow unbounded
  if (memoryWindows.size > 10_000) {
    for (const [k, v] of memoryWindows) {
      if (now >= v.resetAt) memoryWindows.delete(k)
    }
  }
  return { ok: true }
}

export async function checkContactFormRateLimit(ip: string): Promise<void> {
  const res = await hitRateLimit(ip)
  if (!res.ok) {
    throw new RateLimitedError(
      `Too many contact submissions. Try again in ${res.retryAfterSec}s.`,
      res.retryAfterSec
    )
  }
}

/** Test helper — clear the in-memory window store. */
export function _resetWebContactRateLimitForTests() {
  memoryWindows.clear()
}
