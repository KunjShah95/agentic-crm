import { describe, it, expect } from "vitest"
import { css, scan, SCOPE } from "../helpers/source-scan"

const sheet = css()

/** The sanctioned scale. Values are pinned, not just the token names. */
const STEPS = [
  ["xs", "4px"],
  ["sm", "6px"],
  ["md", "10px"],
] as const

describe("globals.css radius tokens", () => {
  it("defines the sanctioned radius steps", () => {
    for (const [step, value] of STEPS) {
      expect(sheet, `--radius-${step} must be ${value}`).toMatch(
        new RegExp(`--radius-${step}:\\s*${value}\\s*;`)
      )
    }
  })

  it("retires the oversized radius steps", () => {
    for (const step of ["lg", "xl", "2xl", "3xl", "4xl"]) {
      expect(sheet, `--radius-${step} should be removed`).not.toMatch(
        new RegExp(`--radius-${step}:`)
      )
    }
  })

  it("keeps the --radius base that vendored shadcn derives from", () => {
    expect(sheet, "--radius shim must stay in sync with --radius-md (10px)").toMatch(
      /--radius:\s*10px\s*;/
    )
  })
})

describe("conformance scope integrity", () => {
  it("keeps the conformance scope covering every component tree", () => {
    // Component trees are auto-discovered; app dirs are hardcoded and pinned.
    expect(SCOPE).toContain("app/(app)")
    expect(SCOPE).toContain("app/(auth)")
    expect(SCOPE).toContain("app/buyer")
    expect(SCOPE).toContain("app/invite")
    expect(SCOPE.length, "scope shrank — a component tree may have been renamed").toBeGreaterThanOrEqual(20)
    expect(SCOPE).not.toContain("components/ui")
    expect(SCOPE).not.toContain("components/landing")
  })

  it("resolves every conformance scope entry to at least one file", () => {
    for (const dir of SCOPE) {
      const files = scan(/./, { roots: [dir], includeComments: true }).length
      expect(files, `${dir} matched no files`).toBeGreaterThan(0)
    }
  })
})
