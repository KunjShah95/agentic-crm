import { describe, it, expect } from "vitest"
import { generateCLP, DEFAULT_CLP } from "@/modules/payments/clp"

describe("generateCLP", () => {
  it("splits a total across milestones, amounts sum exactly to total", () => {
    const rows = generateCLP(10_000_000, DEFAULT_CLP)
    expect(rows).toHaveLength(DEFAULT_CLP.length)
    const sum = rows.reduce((a, r) => a + r.amount, 0)
    expect(sum).toBe(10_000_000)
  })

  it("default CLP has 8 milestones summing to 100%", () => {
    expect(DEFAULT_CLP).toHaveLength(8)
    expect(DEFAULT_CLP.reduce((a, m) => a + m.pct, 0)).toBe(100)
  })

  it("last milestone absorbs rounding remainder", () => {
    const rows = generateCLP(1_000_001, [{ label: "A", pct: 33.33 }, { label: "B", pct: 33.33 }, { label: "C", pct: 33.34 }])
    expect(rows.reduce((a, r) => a + r.amount, 0)).toBe(1_000_001)
  })

  it("carries label and order", () => {
    const rows = generateCLP(100, [{ label: "Booking", pct: 10 }, { label: "Foundation", pct: 90 }])
    expect(rows[0]).toMatchObject({ label: "Booking", order: 0, amount: 10 })
    expect(rows[1]).toMatchObject({ label: "Foundation", order: 1, amount: 90 })
  })
})
