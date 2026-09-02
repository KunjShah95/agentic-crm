import { describe, it, expect } from "vitest"
import { t } from "@/lib/i18n"
import { tallyCsv } from "@/modules/compliance/export"

describe("i18n", () => {
  it("gu/hi dictionaries exist", () => {
    expect(t("gu", "lead_ack")).toContain("આભાર")
    expect(t("hi", "lead_ack")).toContain("धन्यवाद")
    expect(t("en", "sites_title")).toBe("Available homes")
  })
})

describe("tallyCsv", () => {
  it("header + rows", () => {
    const csv = tallyCsv([{ dealId: "d1", amount: 100, status: "PAID", dueDate: new Date("2026-09-01") }])
    expect(csv).toContain("Vch Type")
    expect(csv).toContain("d1")
  })
})
