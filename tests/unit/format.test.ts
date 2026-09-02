import { describe, expect, it } from "vitest"

import { emailDomain, formatDate, formatMoney, fullName, initials, slugify } from "@/lib/format"

describe("format utils", () => {
  describe("fullName", () => {
    it("joins first and last", () => {
      expect(fullName("Ada", "Lovelace")).toBe("Ada Lovelace")
      expect(fullName("Ada", "")).toBe("Ada")
      expect(fullName("Ada", null)).toBe("Ada")
    })
  })

  describe("initials", () => {
    it("returns two-letter initials", () => {
      expect(initials("Ada Lovelace")).toBe("AL")
      expect(initials("  ada  ")).toBe("A")
      expect(initials("Jean-Claude Van Damme")).toBe("JV")
    })
  })

  describe("formatMoney", () => {
    it("formats USD with symbol", () => {
      expect(formatMoney(1200, "USD")).toMatch(/\$1,200/)
    })
    it("formats INR by default with symbol", () => {
      expect(formatMoney(1200)).toMatch(/₹1,200/)
    })
    it("returns em dash for null", () => {
      expect(formatMoney(null)).toBe("—")
      expect(formatMoney(undefined)).toBe("—")
    })
    it("handles unknown currency gracefully", () => {
      expect(formatMoney(100, "XYZ")).toContain("100")
    })
  })

  describe("formatDate", () => {
    it("formats a Date", () => {
      expect(formatDate(new Date("2026-08-07"))).toMatch(/Aug/)
    })
    it("returns em dash for null", () => {
      expect(formatDate(null)).toBe("—")
      expect(formatDate(undefined)).toBe("—")
    })
  })

  describe("slugify", () => {
    it("lowercases and dashes", () => {
      expect(slugify("Acme Corp")).toBe("acme-corp")
      expect(slugify("  Hello__World!! ")).toBe("hello-world")
    })
    it("truncates to 48", () => {
      const long = "a".repeat(100)
      expect(slugify(long).length).toBe(48)
    })
  })

  describe("emailDomain", () => {
    it("extracts domain", () => {
      expect(emailDomain("ada@acme.com")).toBe("acme.com")
      expect(emailDomain("Ada@Acme.COM")).toBe("acme.com")
      expect(emailDomain("no-at")).toBeNull()
    })
  })
})
