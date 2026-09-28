import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { REPO_ROOT } from "../helpers/source-scan"

/**
 * Dashboard layout conformance.
 *
 * The bug these rules exist to prevent is a CSS one that no type checker and no
 * unit test can see: a `Panel` is a grid item, grid items stretch to the tallest
 * cell in their row, and a fixed-height chart inside a stretched panel leaves
 * dead white space below the plot. It renders, it is not an error, and it looks
 * like a mistake.
 *
 * The fix has two halves, and both are asserted here because either one alone
 * reintroduces it:
 *
 *  1. `Panel` establishes a column flex context, so a `flex-1` child can
 *     actually absorb the extra height.
 *  2. Chart wrappers use `min-h-*` + `flex-1`, never a bare `h-[Npx]`.
 *
 * Together: the chart grows to fill its panel instead of leaving a gap.
 */

function read(rel: string) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8")
}

const dashboard = "app/(app)/[workspace]/dashboard/page.tsx"

describe("panel", () => {
  const panel = read("components/ds/panel.tsx")

  it("establishes a column flex context", () => {
    // Without this, `flex-1` on a child has no effect: the panel is a block
    // container, so a percentage/flex height cannot resolve and the child keeps
    // its intrinsic height while the panel keeps the slack.
    expect(panel).toMatch(/flex flex-col/)
  })

  it("keeps the header from growing when the panel stretches", () => {
    // The header is a fixed 44px strip. In a column flex context a header with
    // no `shrink-0` would compress on a short row and the label would clip.
    const header = panel.slice(panel.indexOf("export function PanelHeader"))
    expect(header).toMatch(/shrink-0/)
  })
})

describe("dashboard chart wrappers", () => {
  const src = read(dashboard)

  it("gives every chart wrapper a min-h floor rather than a fixed height", () => {
    // A bare `h-[Npx]` pins the chart and strands the remainder of the panel.
    // The floor prevents collapse on a short row; `flex-1` lets it grow.
    const wrappers = src.match(/<div className="[^"]*min-h-\[\d+px\][^"]*">/g) ?? []
    expect(wrappers.length, "expected min-h floors on the chart wrappers").toBeGreaterThanOrEqual(2)

    for (const w of wrappers) {
      expect(w).toMatch(/flex-1/)
      // The exact failure from the screenshot: a fixed height on a stretched panel.
      expect(w).not.toMatch(/(?<!min-)h-\[\d+px\]/)
    }
  })

  it("centres the fixed-size charts in their stretched panels", () => {
    // The gauge and the donut are fixed-size squares. Centring them puts the
    // slack above and below equally instead of dumping it all underneath.
    expect(src).toMatch(/flex flex-1 items-center/)
    expect(src).toMatch(/flex flex-1 flex-col justify-center/)
  })

  it("keeps every chart root on the aspect-cancelling fit class", () => {
    // `ChartContainer` hard-codes `aspect-video`; without `aspect-auto` (which
    // twMerge resolves) the chart derives height from width and overflows its
    // panel, which is the same class of visual bug from the other direction.
    const charts = read("components/dashboard/charts.tsx")
    const roots = charts.match(/className=\{FIT\}/g) ?? []
    expect(roots.length).toBeGreaterThanOrEqual(4)
    expect(charts).toMatch(/const FIT = "h-full aspect-auto"/)
  })
})

describe("horizontal bar chart", () => {
  const charts = read("components/dashboard/charts.tsx")

  it("caps bar thickness so the stages stay separable", () => {
    /*
     * Recharts sizes a categorical bar as a fraction of the band width and
     * fills most of the slot. Six stages across ~420px gives ~40px of black
     * per bar, and the rows visually merge into one block — the gaps that
     * separate the stages are the thing carrying the meaning.
     *
     * It has to go through `barProps` because `EvilBarChart` exposes no
     * top-level `barSize`; passing it as a chart prop would be silently ignored.
     */
    expect(charts).toMatch(/barProps=\{\{ barSize: \d+ \}\}/)
  })

  it("disables the library's grow-in animation", () => {
    // The intro is a `motion` element seeded at scale 0, and that seed is what
    // actually paints before hydration. A chart that is genuinely blank for the
    // first few frames is a worse trade than one that simply appears.
    const pipeline = charts.slice(charts.indexOf("export function PipelineByStageChart"))
    expect(pipeline).toMatch(/animationType="none"/)
  })

  it("floors the plot height so labels never overlap", () => {
    expect(charts).toMatch(/min-h-\[\d+px\]/)
  })
})
