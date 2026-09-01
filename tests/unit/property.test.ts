import { describe, it, expect } from "vitest"
describe("RE schema", () => {
  it("defines UnitStatus enum and Project model", async () => {
    const fs = await import("fs")
    const s = fs.readFileSync("prisma/schema.prisma", "utf8")
    expect(s).toContain("enum UnitStatus")
    expect(s).toContain("model Project")
    expect(s).toContain("model Unit")
    expect(s).toContain("model CostSheet")
  })
})
