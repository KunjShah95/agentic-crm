import { describe, it, expect } from "vitest"
import { PLAN_LIMITS } from "@/modules/billing/limits"

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
