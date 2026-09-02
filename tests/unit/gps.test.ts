import { describe, it, expect } from "vitest"
import { haversineMeters, withinRadius } from "@/modules/siteVisits/gps"

describe("gps", () => {
  it("is zero for the same point", () => {
    const p = { lat: 23.0225, lng: 72.5714 }
    expect(haversineMeters(p, p)).toBe(0)
  })

  it("approximates a known short distance", () => {
    // ~1.11 km per 0.01° latitude
    const d = haversineMeters({ lat: 23.0, lng: 72.5 }, { lat: 23.01, lng: 72.5 })
    expect(d).toBeGreaterThan(1050)
    expect(d).toBeLessThan(1150)
  })

  it("withinRadius true inside, false outside", () => {
    const site = { lat: 23.0225, lng: 72.5714 }
    const near = { lat: 23.0226, lng: 72.5715 }
    const far = { lat: 23.1, lng: 72.6 }
    expect(withinRadius(site, near, 100)).toBe(true)
    expect(withinRadius(site, far, 100)).toBe(false)
  })
})
