import { parseUnitsCsv } from "@/lib/csv"
import { describe, it, expect } from "vitest"
describe("parseUnitsCsv", () => {
  it("parses header + 1 row", () => {
    const csv = "unitNo,config,price,status\nA-101,BHK2,5000000,AVAILABLE"
    expect(parseUnitsCsv(csv)).toHaveLength(1)
  })
})
