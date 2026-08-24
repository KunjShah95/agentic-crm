import { describe, it, expect } from "vitest"
import { PLAN_LIMITS } from "@/modules/billing/limits"
import { quotaExceeded, periodKey, periodKeyFor, isQuotaExceeded } from "@/modules/billing/quota"

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

describe("isQuotaExceeded", () => {
  it("returns true when current >= limit", () => {
    expect(isQuotaExceeded(100, 100)).toBe(true)
    expect(isQuotaExceeded(101, 100)).toBe(true)
    expect(isQuotaExceeded(99, 100)).toBe(false)
  })

  it("handles zero", () => {
    expect(isQuotaExceeded(0, 10)).toBe(false)
    expect(isQuotaExceeded(0, 0)).toBe(true)
  })

  it("is consistent with quotaExceeded", async () => {
    const cases: Array<[number, number]> = [
      [0, 10],
      [10, 10],
      [11, 10],
    ]
    for (const [current, limit] of cases) {
      expect(await quotaExceeded("ws1", "contacts", limit, current)).toBe(isQuotaExceeded(current, limit))
    }
  })
})

describe("periodKey", () => {
  it("returns YYYY-MM", () => {
    const d = new Date(Date.UTC(2026, 0, 15, 12, 0, 0))
    expect(periodKey(d)).toBe("2026-01")
    expect(periodKey(new Date(Date.UTC(2026, 11, 31)))).toBe("2026-12")
  })

  it("pads month", () => {
    expect(periodKey(new Date(Date.UTC(2026, 8, 1)))).toBe("2026-09")
  })
})

describe("periodKeyFor", () => {
  it("returns YYYY-MM for monthly kinds", () => {
    const d = new Date(Date.UTC(2026, 5, 15, 10, 0, 0))
    expect(periodKeyFor("social_messages", d)).toBe("2026-06")
    expect(periodKeyFor("contacts", d)).toBe("2026-06")
    expect(periodKeyFor("seats", d)).toBe("2026-06")
  })

  it("returns YYYY-MM-DD for webhook_events (daily granularity)", () => {
    const d = new Date(Date.UTC(2026, 5, 15, 10, 0, 0))
    expect(periodKeyFor("webhook_events", d)).toBe("2026-06-15")
    expect(periodKeyFor("webhook_events", new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05")
  })

  it("daily period changes per day, monthly does not", () => {
    const day1 = new Date(Date.UTC(2026, 5, 15))
    const day2 = new Date(Date.UTC(2026, 5, 16))
    // monthly kinds same period across days in same month
    expect(periodKeyFor("social_messages", day1)).toBe(periodKeyFor("social_messages", day2))
    // webhook_events different period per day
    expect(periodKeyFor("webhook_events", day1)).not.toBe(periodKeyFor("webhook_events", day2))
  })

  it("pads month and day for webhook_events", () => {
    expect(periodKeyFor("webhook_events", new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05")
    expect(periodKeyFor("webhook_events", new Date(Date.UTC(2026, 8, 9)))).toBe("2026-09-09")
  })

  it("defaults to current date when no date provided", () => {
    const now = new Date()
    const expectedMonthly = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
    const expectedDaily = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`
    expect(periodKeyFor("social_messages")).toBe(expectedMonthly)
    expect(periodKeyFor("webhook_events")).toBe(expectedDaily)
  })

  it("periodKeyFor is consistent with periodKey for non-daily kinds", () => {
    const d = new Date(Date.UTC(2026, 3, 20))
    expect(periodKeyFor("social_messages", d)).toBe(periodKey(d))
    expect(periodKeyFor("contacts", d)).toBe(periodKey(d))
    expect(periodKeyFor("seats", d)).toBe(periodKey(d))
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

describe("mapStripePlan", () => {
  it("maps Stripe subscription.updated to plan", async () => {
    const { mapStripePlan } = await import("@/modules/billing/stripe")
    expect(mapStripePlan("price_pro_xxx")).toBe("pro")
    expect(mapStripePlan("price_scale_xxx")).toBe("scale")
    expect(mapStripePlan("price_unknown")).toBe("free")
    expect(mapStripePlan("")).toBe("free")
  })
})
