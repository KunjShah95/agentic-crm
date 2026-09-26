import { describe, it, expect } from "vitest"
import { scan, css, expectNoViolations } from "../helpers/source-scan"

const sheet = css()

describe("surface tokens", () => {
  it("defines canvas, raised, sunken, and hairline in both modes", () => {
    for (const token of [
      "--surface-canvas",
      "--surface-raised",
      "--surface-sunken",
      "--hairline",
    ]) {
      const occurrences = sheet.split(`--${token.slice(2)}:`).length - 1
      expect(occurrences, `${token} must be defined in :root and .dark`).toBe(2)
    }
  })

  it("retains the three elevation steps", () => {
    for (const step of ["e1", "e2", "e3"]) {
      expect(sheet, `missing --shadow-${step}`).toMatch(
        new RegExp(`--shadow-${step}:`)
      )
    }
  })

  it("has no decorative gradient wrappers in app code", () => {
    const v = scan(/blur-2xl/)
    expectNoViolations(v, "decorative blur")
  })
})
