import { projectSchema, unitSchema, costSheetSchema } from "@/lib/validators/re"
import { describe, it, expect } from "vitest"
describe("re validators", () => {
  it("rejects empty project name", () => {
    expect(() => projectSchema.parse({ name: "" })).toThrow()
  })
  it("accepts valid unit", () => {
    expect(() => unitSchema.parse({ projectId: "p1", unitNo: "A-101", price: 5000000, config: "BHK2" })).not.toThrow()
  })
  it("calculates costSheet total validation", () => {
    expect(() => costSheetSchema.parse({ unitId: "u1", basePrice: -1 })).toThrow()
  })
})
