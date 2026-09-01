import { normalizeLead } from "@/modules/leadIngest/normalize"
import { describe, it, expect } from "vitest"

describe("normalizeLead", () => {
  it("normalizes a 99acres-style payload", () => {
    const n = normalizeLead("ninety_nine_acres", {
      lead_id: "99-123",
      name: "Ravi Patel",
      phone: "+919812345678",
      email: "ravi@example.com",
      project: "Sun Residency",
      budget: "80-90 Lakh",
      config: "3BHK",
      locality: "SG Highway",
    })
    expect(n.externalId).toBe("99-123")
    expect(n.firstName).toBe("Ravi")
    expect(n.lastName).toBe("Patel")
    expect(n.phone).toBe("+919812345678")
    expect(n.source).toBe("NINETY_NINE_ACRES")
    expect(n.config).toBe("BHK3")
  })
  it("normalizes generic Pabbly payload with fallback dedupe key", () => {
    const n = normalizeLead("pabbly", { full_name: "Asha", mobile: "9876500000" })
    expect(n.firstName).toBe("Asha")
    expect(n.phone).toBe("9876500000")
    expect(n.source).toBe("PABBLY")
    expect(n.externalId).toBeTruthy()
  })
  it("maps unknown source to WEBSITE", () => {
    const n = normalizeLead("website", { name: "X", phone: "1" })
    expect(n.source).toBe("WEBSITE")
  })
})
