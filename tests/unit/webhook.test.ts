import { describe, it, expect } from "vitest"
import fs from "fs"
describe("webhook schema", () => {
  it("defines WebhookEvent with dedupeKey unique", () => {
    const s = fs.readFileSync("prisma/schema.prisma","utf8")
    expect(s).toContain("model WebhookEvent")
    expect(s).toContain("dedupeKey")
    expect(s).toContain("@unique")
  })
})
