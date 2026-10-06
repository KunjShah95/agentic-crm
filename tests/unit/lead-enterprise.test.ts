import { describe, it, expect } from "vitest"
import {
  canonicalSource,
  isAcceptedSourceSlug,
  normalizeSlug,
  KNOWN_SLUGS,
} from "@/modules/leadIngest/sources"
import { normalizeLead } from "@/modules/leadIngest/normalize"
import { calcLeadScore, sourcePoints } from "@/modules/leadIngest/scoring"

describe("enterprise source registry", () => {
  it("keeps known portals on canonical names", () => {
    expect(canonicalSource("99acres")).toBe("NINETY_NINE_ACRES")
    expect(canonicalSource("facebook")).toBe("META")
    expect(canonicalSource("walk_in")).toBe("WALK_IN")
    expect(canonicalSource("pabbly")).toBe("PABBLY")
  })

  it("accepts any well-formed company slug with zero code change", () => {
    expect(isAcceptedSourceSlug("acme-crm")).toBe(true)
    expect(canonicalSource("acme-crm")).toBe("ACME_CRM")
    expect(canonicalSource("lobello_estates")).toBe("LOBELLO_ESTATES")
    expect(isAcceptedSourceSlug("oracle-cx-partner")).toBe(true)
  })

  it("rejects malformed slugs before DB work", () => {
    expect(isAcceptedSourceSlug("")).toBe(false)
    expect(isAcceptedSourceSlug("../escape")).toBe(false)
    expect(isAcceptedSourceSlug("a")).toBe(false)
    expect(canonicalSource("")).toBe("WEBSITE")
  })

  it("registry covers every slug the old hardcoded route set accepted", () => {
    for (const slug of [
      "ninety_nine_acres", "99acres", "magic_bricks", "magicbricks", "housing",
      "nobroker", "meta", "facebook", "google", "website", "walk_in", "pabbly",
    ]) {
      expect(KNOWN_SLUGS.has(slug)).toBe(true)
      expect(isAcceptedSourceSlug(slug)).toBe(true)
    }
  })

  it("normalizeSlug lowercases and trims", () => {
    expect(normalizeSlug("  Acme-CRM ")).toBe("acme-crm")
  })
})

describe("enterprise normalizeLead", () => {
  it("normalizes an enterprise CRM payload with camelCase keys", () => {
    const n = normalizeLead("acme-crm", {
      record_id: "ACME-1042",
      contact_name: "Asha Shah",
      mobileNumber: "+919820012345",
      expected_budget: "55-70 Lakh",
      unitType: "2BHK",
      preferredLocation: "Bopal",
    })
    expect(n.source).toBe("ACME_CRM")
    expect(n.externalId).toBe("ACME-1042")
    expect(n.firstName).toBe("Asha")
    expect(n.config).toBe("BHK2")
    expect(n.budgetMin).toBe(5500000)
    expect(n.budgetMax).toBe(7000000)
    expect(n.dedupeKey).toBe("ACME_CRM:ACME-1042")
  })

  it("unwraps nested Zapier/Pabbly wrappers", () => {
    const n = normalizeLead("zapier", {
      data: { full_name: "Ravi Patel", phone: "+919812345678", project_name: "Sun Residency" },
    })
    expect(n.firstName).toBe("Ravi")
    expect(n.phone).toBe("+919812345678")
    expect(n.project).toBe("Sun Residency")
  })

  it("unwraps { lead: {...} } enterprise wrappers", () => {
    const n = normalizeLead("hubspot", {
      lead: { first_name: "Meera", last_name: "Nair", email: "meera@example.com" },
    })
    expect(n.firstName).toBe("Meera")
    expect(n.lastName).toBe("Nair")
    expect(n.source).toBe("HUBSPOT")
  })

  it("existing portal payloads keep exact canonical names (no regression)", () => {
    const n = normalizeLead("ninety_nine_acres", {
      lead_id: "99-123",
      name: "Ravi Patel",
      phone: "+919812345678",
      config: "3BHK",
    })
    expect(n.source).toBe("NINETY_NINE_ACRES")
    expect(n.config).toBe("BHK3")
  })
})

describe("enterprise scoring", () => {
  it("custom company slugs score like a pipe, not zero", () => {
    expect(sourcePoints("ACME_CRM")).toBeGreaterThan(0)
    expect(calcLeadScore({ source: "ACME_CRM", intent: "HOT", config: "BHK3", budgetMax: 9000000 })).toBeGreaterThan(
      calcLeadScore({ source: "PABBLY", intent: "COLD" })
    )
  })

  it("known weights are untouched", () => {
    expect(sourcePoints("WALK_IN")).toBe(25)
    expect(sourcePoints("META")).toBe(15)
  })
})
