import { describe, it, expect } from "vitest"
import { scan, css, expectNoViolations } from "../helpers/source-scan"

describe("type scope", () => {
  it("has no global display-font rule on headings", () => {
    const sheet = css()
    const globalRule = /h1,\s*h2,\s*h3\s*\{[^}]*font-family/
    expect(sheet, "globals.css still assigns font-display to all h1-h3").not.toMatch(
      globalRule
    )
  })

  it("requires a data-mono marker on every font-mono use", () => {
    // Legitimate mono (money, IDs, secrets, URLs) declares itself with
    // data-mono="money|id|secret|url" on the same element. Anything without
    // the marker is chrome. No keyword guessing — the marker IS the policy.
    const uses = scan(/font-mono/)
    const offenders = uses.filter(
      (v) => !/data-mono="(money|id|secret|url)"/.test(v.text)
    )
    expectNoViolations(offenders, "unmarked font-mono")
  })
})
