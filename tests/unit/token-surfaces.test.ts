import { describe, it, expect } from "vitest"
import { scan, css, expectNoViolations, SCOPE } from "../helpers/source-scan"

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

  it("has no decorative gradient wrappers in the workspace shell", () => {
    // app/(auth) is intentionally excluded: the login/signup front door keeps
    // a deliberate on-brand glow (bg-brand/10 blur-3xl + brand hairline in
    // app/(auth)/layout.tsx). That treatment was never in visual scope —
    // Direction A governs the workspace, not the front door. Stripping it
    // would make auth stark for no benefit, so the rule covers the shell
    // where the off-brand washes were actually removed.
    //
    // The marketing tree is also intentionally excluded. Direction A governs
    // the workspace, not the brand surface: the marketing site keeps its
    // deliberate hero decoration (ShaderBackground, SpotlightGrid, and the
    // brand glow blob in components/landing/sections/hero.tsx). Marketing is
    // still covered by the radius, type, and status rules — this is a
    // per-rule exclusion, not a scope exclusion.
    //
    // The scan covers blur-2xl AND blur-3xl so a reintroduced wash of either
    // size fails — but NOT backdrop-blur-*, which is functional frosted glass
    // (e.g. the sticky topbar), not decoration. A future app/* route dir is
    // covered automatically because SCOPE auto-discovers app trees.
    const roots = SCOPE.filter(
      (d) => !["app/(auth)", "components/landing", "app/(marketing)"].includes(d)
    )
    const v = scan(/(?<!backdrop-)blur-(2xl|3xl)/, { roots })
    expectNoViolations(v, "decorative blur")
  })
})
