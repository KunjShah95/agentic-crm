import { calcTotal } from "@/modules/costSheet/calc"
import { describe, it, expect } from "vitest"
describe("calcTotal", () => {
  it("sums base+gst+stamp+others", () => {
    expect(calcTotal({ basePrice: 5000000, gst: 250000, stampDuty: 300000, otherCharges: { maintenance: 50000 } })).toBe(5600000)
  })
  it("is numeric, INR default", () => {
    expect(calcTotal({ basePrice: 100 })).toBeGreaterThan(99)
  })
})
