import { describe, expect, it } from "vitest"

import { emailDomain, formatDate, formatMoney, formatMoneyShort, fullName, initials, slugify } from "@/lib/format"

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

  describe("formatMoneyShort", () => {
    /*
     * The regression this file exists for: the crore constant was written as
     * `10_00_00_000` (= 100,000,000) instead of `1_00_00_000` (= 10,000,000).
     *
     * The failure is silent and self-contradicting rather than obviously wrong,
     * because it only moves the *Cr* branch and leaves the *L* branch exact. An
     * axis over 0..1.2 crore therefore read "300 L / 600 L / 900 L / 1.2 Cr" —
     * four identical steps whose last one jumps by ten times the other three —
     * and every total above a crore was understated 10x. Both halves are
     * asserted below: the absolute value, and that consecutive ticks step evenly.
     */
    it("uses 10,000,000 as one crore, not 100,000,000", () => {
      expect(formatMoneyShort(1_00_00_000)).toBe("₹1 Cr")
      expect(formatMoneyShort(10_00_00_000)).toBe("₹10 Cr")
      expect(formatMoneyShort(3_00_00_000)).toBe("₹3 Cr")
    })

    it("switches to crore exactly at one crore", () => {
      expect(formatMoneyShort(99_00_000)).toBe("₹99 L")
      expect(formatMoneyShort(1_00_00_000)).toBe("₹1 Cr")
    })

    it("keeps lakh exact below the crore threshold", () => {
      expect(formatMoneyShort(1_00_000)).toBe("₹1 L")
      expect(formatMoneyShort(30_00_000)).toBe("₹30 L")
      expect(formatMoneyShort(98_50_000)).toBe("₹98.5 L")
    })

    it("drops a trailing .0 rather than rendering it", () => {
      expect(formatMoneyShort(1_00_00_000)).not.toContain(".0")
      expect(formatMoneyShort(2_00_00_000)).not.toContain(".0")
    })

    it("produces evenly spaced axis ticks across the crore boundary", () => {
      // Recharts' nice ticks for a won-value axis topping out at 12 crore.
      const ticks = [0, 3_00_00_000, 6_00_00_000, 9_00_00_000, 12_00_00_000].map((v) =>
        formatMoneyShort(v),
      )
      expect(ticks).toEqual(["₹0", "₹3 Cr", "₹6 Cr", "₹9 Cr", "₹12 Cr"])
    })

    it("formats a real dashboard total without understating it", () => {
      // The kunjshah workspace open pipeline: 24 deals summing to ₹28,22,00,000.
      expect(formatMoneyShort(28_22_00_000)).toBe("₹28.2 Cr")
    })

    it("returns an em dash for null", () => {
      expect(formatMoneyShort(null)).toBe("—")
      expect(formatMoneyShort(undefined)).toBe("—")
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
