import { describe, it, expect } from "vitest"
import { computeCommission } from "@/modules/brokers/commission"

describe("computeCommission", () => {
  it("uses explicit amount when provided", () => {
    expect(computeCommission(10_000_000, { amount: 150_000 })).toBe(150_000)
  })
  it("computes from pct when no amount", () => {
    expect(computeCommission(10_000_000, { pct: 2 })).toBe(200_000)
  })
  it("explicit amount wins over pct", () => {
    expect(computeCommission(10_000_000, { pct: 2, amount: 50_000 })).toBe(50_000)
  })
  it("clamps negatives to zero and rounds", () => {
    expect(computeCommission(10_000_000, { pct: -5 })).toBe(0)
    expect(computeCommission(999_999, { pct: 1.5 })).toBe(15_000)
  })
  it("zero when nothing provided", () => {
    expect(computeCommission(10_000_000, {})).toBe(0)
  })
})
