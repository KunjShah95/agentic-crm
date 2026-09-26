import { describe, it, expect } from "vitest"
import { scan, css, expectNoViolations } from "../helpers/source-scan"

const sheet = css()
const PALETTE =
  /(text|bg|border|ring|from|to|via)-(emerald|amber|blue|red|green|orange|yellow|violet|purple|rose|indigo|teal|cyan|slate)-(400|500|600|700)/

const STATUSES = ["positive", "caution", "critical", "info", "neutral"] as const

describe("status tokens", () => {
  it("defines every status pair in both modes", () => {
    for (const s of STATUSES) {
      for (const slot of ["bg", "fg"]) {
        const token = `--status-${s}-${slot}`
        const occurrences = sheet.split(`${token}:`).length - 1
        expect(occurrences, `${token} must be defined in :root and .dark`).toBe(2)
      }
    }
  })

  it("uses no raw palette color in app code", () => {
    // The shade range is deliberately 400–700. Lighter/darker companions
    // (-200/-300/-800/-900, e.g. border-red-200/dark:border-red-800 pairs in
    // follow-up-nudge.tsx) are a conscious deferral, not an oversight:
    // "stale"/orange has no status-token equivalent, and migrating the border
    // without the fill would fork the visual language. If a sixth pair is ever
    // added, extend the alternation below and migrate those pairs with it.
    const v = scan(PALETTE)
    expectNoViolations(v, "raw palette color")
  })
})
