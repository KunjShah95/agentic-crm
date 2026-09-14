import { describe, expect, it } from "vitest"

import {
  BASE_COMMISSION_PCT,
  URGENCY_UPLIFT_PP,
  dealTypeFromUnitConfig,
  effectiveCommissionPct,
  expectedCommission,
  normalizeDealType,
  normalizeUrgency,
} from "@/modules/deals/commission"

describe("commission weighting", () => {
  it("maps unit configs to categories", () => {
    expect(dealTypeFromUnitConfig("PLOT")).toBe("PLOT")
    expect(dealTypeFromUnitConfig("VILLA")).toBe("VILLA")
    expect(dealTypeFromUnitConfig("BHK3")).toBe("FLAT")
    expect(dealTypeFromUnitConfig("OFFICE")).toBe("OFFICE")
    expect(dealTypeFromUnitConfig(null)).toBeNull()
  })

  it("explicit dealType wins over unit config; FLAT is the fallback", () => {
    expect(normalizeDealType("BUNGALOW", "PLOT")).toBe("BUNGALOW")
    expect(normalizeDealType(null, "SHOP")).toBe("SHOP")
    expect(normalizeDealType(null, null)).toBe("FLAT")
    expect(normalizeDealType("NONSENSE", "VILLA")).toBe("VILLA")
  })

  it("unknown urgency falls back to NORMAL (no uplift)", () => {
    expect(normalizeUrgency("DISTRESS")).toBe("DISTRESS")
    expect(normalizeUrgency("asdasd")).toBe("NORMAL")
    expect(URGENCY_UPLIFT_PP.NORMAL).toBe(0)
  })

  it("land pays most, corporate least", () => {
    expect(BASE_COMMISSION_PCT.PLOT).toBeGreaterThan(BASE_COMMISSION_PCT.FLAT)
    expect(BASE_COMMISSION_PCT.FLAT).toBeGreaterThanOrEqual(BASE_COMMISSION_PCT.CORPORATE_HOUSE)
  })

  it("urgency adjusts the effective percentage points", () => {
    expect(effectiveCommissionPct("VILLA", "DISTRESS")).toBeCloseTo(3.5)
    expect(effectiveCommissionPct("VILLA", "HIGH")).toBeCloseTo(3.0)
    expect(effectiveCommissionPct("VILLA", "LOW")).toBeCloseTo(2.25)
    // never negative
    expect(effectiveCommissionPct("CORPORATE_HOUSE", "LOW")).toBeCloseTo(1.25)
  })

  it("expected commission rounds to rupees", () => {
    // 3,10,00,000 × (3% base + 1pp distress) = 4% → ₹12,40,000
    expect(expectedCommission(31_000_000, "PLOT", "DISTRESS")).toBe(1_240_000)
    expect(expectedCommission(31_000_000, "PLOT", "NORMAL")).toBe(930_000)
    expect(expectedCommission(0, "PLOT", "HIGH")).toBe(0)
  })
})
