import { calcLeadScore } from "@/modules/leadIngest/scoring"
import { describe, it, expect } from "vitest"

describe("calcLeadScore", () => {
  it("returns 0-100 clamped", () => {
    const s = calcLeadScore({ source: "WALK_IN", intent: "HOT", config: "BHK3", budgetMax: 9000000, locality: "SG Highway", targetLocalities: ["SG Highway"] })
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThanOrEqual(100)
  })
  it("hot walk-in scores higher than cold pabbly lead", () => {
    const hot = calcLeadScore({ source: "WALK_IN", intent: "HOT", config: "BHK3", budgetMax: 9000000 })
    const cold = calcLeadScore({ source: "PABBLY", intent: "COLD" })
    expect(hot).toBeGreaterThan(cold)
  })
  it("locality match adds points", () => {
    const match = calcLeadScore({ source: "META", locality: "Bopal", targetLocalities: ["Bopal"] })
    const noMatch = calcLeadScore({ source: "META", locality: "Bopal", targetLocalities: ["Chandkheda"] })
    expect(match).toBeGreaterThan(noMatch)
  })
  it("handles empty input", () => {
    expect(calcLeadScore({})).toBeGreaterThanOrEqual(0)
  })
})
