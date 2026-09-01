import { renderShortcodes } from "@/modules/documents/shortcodes"
import { describe, it, expect } from "vitest"
describe("shortcodes", () => {
  it("replaces {{rera_no}} and {{total}}", () => {
    expect(renderShortcodes("RERA {{rera_no}} total {{total}}", { rera_no: "M/GUJ/1", total: "5600000" })).toBe("RERA M/GUJ/1 total 5600000")
  })
})
