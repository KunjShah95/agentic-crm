import { describe, it, expect } from "vitest"
import { PLAN_LIMITS } from "@/modules/billing/limits"
import { quotaExceeded } from "@/modules/billing/quota"

describe("quotaExceeded", () => {
  it("detects quota exceeded when current >= limit", async () => {
    expect(await quotaExceeded("ws1", "social_messages", 100, 101)).toBe(true)
    expect(await quotaExceeded("ws1", "social_messages", 100, 100)).toBe(true)
    expect(await quotaExceeded("ws1", "social_messages", 100, 99)).toBe(false)
  })

  it("returns false when under limit and true when at or over", async () => {
    expect(await quotaExceeded("ws1", "contacts", 500, 0)).toBe(false)
    expect(await quotaExceeded("ws1", "webhook_events", 500, 500)).toBe(true)
  })
})

describe("PlanLimits", () => {
  it("free has lower quotas than pro", () => {
    expect(PLAN_LIMITS.free.msgPerMonth).toBeLessThan(PLAN_LIMITS.pro.msgPerMonth)
  })
  it("has required keys", () => {
    for (const plan of Object.values(PLAN_LIMITS)) {
      expect(plan).toHaveProperty("maxSeats")
      expect(plan).toHaveProperty("msgPerMonth")
    }
  })
})
