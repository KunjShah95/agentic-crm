import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const env = { UPSTASH_REDIS_REST_URL: undefined as string | undefined, UPSTASH_REDIS_REST_TOKEN: undefined as string | undefined }

vi.mock("std-env", () => ({ env }))

import {
  hitRateLimit,
  checkContactFormRateLimit,
  RateLimitedError,
  getClientIp,
  _resetWebContactRateLimitForTests,
} from "@/modules/web-contact/rate-limit"

describe("web-contact rate limit (memory fallback)", () => {
  beforeEach(() => {
    _resetWebContactRateLimitForTests()
    env.UPSTASH_REDIS_REST_URL = undefined
    env.UPSTASH_REDIS_REST_TOKEN = undefined
  })

  it("allows up to max hits, then blocks with retryAfter", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await hitRateLimit("1.2.3.4")
      expect(r.ok).toBe(true)
    }
    const blocked = await hitRateLimit("1.2.3.4")
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })

  it("tracks IPs independently", async () => {
    for (let i = 0; i < 5; i++) await hitRateLimit("1.1.1.1")
    const other = await hitRateLimit("2.2.2.2")
    expect(other.ok).toBe(true)
  })

  it("window reset allows again after expiry", async () => {
    for (let i = 0; i < 5; i++) await hitRateLimit("3.3.3.3", { windowMs: 20, max: 2 })
    await new Promise((r) => setTimeout(r, 25))
    const r = await hitRateLimit("3.3.3.3", { windowMs: 20, max: 2 })
    expect(r.ok).toBe(true)
  })

  it("checkContactFormRateLimit throws RateLimitedError when exceeded", async () => {
    for (let i = 0; i < 5; i++) await checkContactFormRateLimit("5.5.5.5")
    await expect(checkContactFormRateLimit("5.5.5.5")).rejects.toBeInstanceOf(RateLimitedError)
  })

  it("getClientIp prefers x-forwarded-for first hop", () => {
    const h = new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1", "x-real-ip": "8.8.8.8" })
    expect(getClientIp(h)).toBe("9.9.9.9")
    expect(getClientIp(new Headers())).toBe("unknown")
  })
})
