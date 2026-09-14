import { describe, expect, it } from "vitest"
import { buildSignal, heatScore, leadTemperature } from "@/lib/signals"

describe("leadTemperature", () => {
  it("marks high-scored leads hot", () => {
    expect(leadTemperature({ leadScore: 80 })).toBe("hot")
  })

  it("marks recent site visitors hot regardless of score", () => {
    expect(leadTemperature({ leadScore: 20, daysSinceSiteVisit: 1 })).toBe("hot")
  })

  it("marks medium scores warm", () => {
    expect(leadTemperature({ leadScore: 55 })).toBe("warm")
  })

  it("marks low scores nurture", () => {
    expect(leadTemperature({ leadScore: 10 })).toBe("nurture")
  })

  it("marks empty leads cold", () => {
    expect(leadTemperature({})).toBe("cold")
  })
})

describe("heatScore", () => {
  it("boosts a score after a recent site visit", () => {
    expect(heatScore({ leadScore: 60, daysSinceSiteVisit: 2 })).toBeGreaterThan(60)
  })

  it("clamps at 100", () => {
    expect(heatScore({ leadScore: 95, daysSinceSiteVisit: 0 })).toBe(100)
  })

  it("never goes below 0", () => {
    expect(heatScore({ leadScore: 0, hoursSinceContact: 200 })).toBe(0)
  })
})

describe("buildSignal", () => {
  it("recommends calling a hot lead with no recent contact", () => {
    const s = buildSignal({ leadScore: 85, hoursSinceContact: 30 })
    expect(s.temperature).toBe("hot")
    expect(s.ctaLabel).toBe("Call now")
    expect(s.reasons).toContain("Scored 85/100")
    expect(s.reasons.some((r) => r.includes("No contact"))).toBe(true)
  })

  it("recommends WhatsApp when contact was very recent", () => {
    const s = buildSignal({ leadScore: 75, hoursSinceContact: 2 })
    expect(s.temperature).toBe("hot")
    expect(s.ctaLabel).toBe("WhatsApp")
  })

  it("always explains the why (no opaque black box)", () => {
    expect(buildSignal({ leadScore: 42 }).reasons.length).toBeGreaterThan(0)
  })
})