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

/**
 * Money wiring.
 *
 * `formatMoneyShort` defaults to INR, and the dashboard's totals are a rollup
 * that picks its own reporting currency (`getDashboardData().currency`). Every
 * consumer therefore has to pass that currency in explicitly — and nothing in
 * the type system stops it, because the parameter is optional. A CAD workspace
 * whose page forgot one call renders a rupee sign over a Canadian dollar
 * figure, which is invisible in review and indefensible in front of a client.
 *
 * These assertions fail on the omission rather than on a wrong value, because
 * the wrong value only exists at runtime against real data.
 */
describe("dashboard money formatting", () => {
  const page = read(dashboard)
  const table = read("components/dashboard/pipeline-table.tsx")
  const charts = read("components/dashboard/charts.tsx")

  it("never calls formatMoneyShort on a dashboard figure without a currency", () => {
    // A single-argument call means the INR default.
    const bare = page.match(/formatMoneyShort\([^,)]+\)/g) ?? []
    expect(bare, `bare formatMoneyShort calls: ${bare.join(" | ")}`).toHaveLength(0)
  })

  it("routes the page's figures through a currency-aware helper", () => {
    expect(page).toMatch(/const money = \(value: number \| null \| undefined\) =>/)
    expect(page).toMatch(/formatMoneyShort\(value, data\.currency\)/)
    expect(page).toMatch(/money\(data\.openPipeline\)/)
  })

  it("passes the reporting currency into the pipeline table footer", () => {
    expect(table).toMatch(/formatMoneyShort\(openPipeline, currency\)/)
    expect(page).toMatch(/currency=\{data\.currency\}/)
  })

  it("formats the won-chart axis in the reporting currency", () => {
    expect(charts).toMatch(/tickFormatter=\{\(value: number\) => formatMoneyShort\(value, currency\)\}/)
    expect(page).toMatch(/<WonRevenueChart[^>]*currency=\{data\.currency\}/)
  })

  it("reads units from the real count, not from the four most recent projects", () => {
    // `recentProjects` is `take: 4`, so summing it undercounts every workspace
    // with more than four projects.
    expect(page).toMatch(/counts\.units/)
    expect(page).not.toMatch(/data\.projects\.reduce/)
    expect(read("modules/dashboard/queries.ts")).toMatch(/db\.unit\.count/)
  })

  it("names the month on the Won sub-line rather than reading the current bucket", () => {
    // `wonByMonth.at(-1)` is the *current* month, so any workspace that has not
    // closed a deal this calendar month reads "₹0 this month" no matter how much
    // it has actually won. Comments are stripped so the note explaining the
    // original bug cannot satisfy (or trip) the assertion.
    const code = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
    expect(code).not.toMatch(/wonByMonth\.at\(-1\)/)
    expect(page).toMatch(/reverse\(\)\.find\(\(m\) => m\.value > 0\)/)
  })
})

/**
 * `wonAt` is a maintained column, not a derived one.
 *
 * The dashboard buckets won revenue by `Deal.wonAt`, which means every write
 * path that can change a deal's stage has to maintain it. Miss one and the
 * revenue trend silently mis-buckets that path's deals — no error, no warning,
 * just a chart that is confidently wrong.
 *
 * There is no deals API, so all stage writes live in `lib/actions/deals.ts` and
 * there are exactly four of them. The count is asserted alongside the coverage
 * so that adding a fifth path fails until it is accounted for here.
 */
describe("wonAt maintenance", () => {
  const page = read(dashboard)
  const actions = read("lib/actions/deals.ts")
  const code = actions.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

  it("declares the column and stamps it on every stage write", () => {
    expect(read("prisma/schema.prisma")).toMatch(/wonAt\s+DateTime\?/)
    // One rule, one helper — not an inline ternary at each of the four sites.
    expect(code).toMatch(/function wonAtForStage\(kind: StageKind\)/)
    expect(code).toMatch(/isWonKind\(kind\) \? new Date\(\) : null/)
  })

  it("covers every path that writes stageId", () => {
    // Each of these takes a stage from the client and therefore can change a
    // deal's stage, so each has to pass wonAt through the helper.
    const stageWrites = code.match(/stageId: [^,\n]+/g) ?? []
    expect(stageWrites.length).toBeGreaterThanOrEqual(4)

    // Four call sites: create, update, bulk move, single move.
    const stamps = code.match(/wonAt: wonAtForStage\(/g) ?? []
    expect(stamps.length).toBe(4)
  })

  it("buckets revenue by wonAt with an updatedAt fallback, never updatedAt alone", () => {
    const queries = read("modules/dashboard/queries.ts")
    expect(queries).toMatch(/wonAt: wonAtForStage|wonAt: true/)
    expect(queries).toMatch(/deal\.wonAt \?\? deal\.updatedAt/)
    // The old proxy, on its own, is the bug.
    expect(queries).not.toMatch(/monthKey\(deal\.updatedAt\)/)
  })

  it("resolves the Won name from the shared module, not a local copy", () => {
    // A second literal would be free to drift from the write path's.
    expect(code).not.toMatch(/=== "Won"/)
    expect(code).toMatch(/from "@\/lib\/pipeline-stages"/)
    expect(read("modules/dashboard/queries.ts")).toMatch(/from "@\/lib\/pipeline-stages"/)
  })

  it("keeps the chart hint describing when the deal was won", () => {
    expect(page).toMatch(/by the month each deal was won/)
    expect(page).not.toMatch(/last touched in Won/)
  })
})

/**
 * `PipelineStage.kind`, not `PipelineStage.name`.
 *
 * `kind` exists so that renaming a stage cannot change what it means. That
 * guarantee is only real if *nothing* branches on the name any more — one
 * leftover `stage.name === "Won"` anywhere silently reintroduces the original
 * bug on that one code path, and it fails quietly: the page still renders, the
 * numbers just move.
 *
 * The name comparison below is the exact shape that has to stay gone. Stage
 * names are user-editable, so any of them can become "Won" or stop being it.
 */
describe("stage kind over stage name", () => {
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

  it("branches on kind, never on the stage name, in decision code", () => {
    const decisionFiles = [
      "lib/actions/deals.ts",
      "modules/dashboard/queries.ts",
      "modules/deals/queries.ts",
      "modules/reports/queries.ts",
    ]
    for (const file of decisionFiles) {
      const src = strip(read(file))
      expect(src, `${file} compares a stage name`).not.toMatch(
        /stage\.name\s*===\s*["'](Won|Lost)["']/,
      )
      expect(src, `${file} compares a stage name`).not.toMatch(
        /name\s*===\s*["'](Won|Lost)["']\s*\|\|\s*name\s*===\s*["']Lost["']/,
      )
    }
  })

  it("has no 'Won'/'Lost' name literals left in the pipeline logic", () => {
    // Display strings and test fixtures may say "Won"; the decision code may not.
    for (const file of [
      "lib/actions/deals.ts",
      "modules/dashboard/queries.ts",
      "modules/deals/queries.ts",
      "lib/default-stages.ts",
    ]) {
      const src = read(file)
      // `lib/default-stages.ts` legitimately names the stage "Won" — that is the
      // label. What it must not do is decide anything by it.
      const decisionish = file === "lib/default-stages.ts" ? src.replace(/"Won"/g, '"<label>"').replace(/"Lost"/g, '"<label>"') : src
      expect(strip(decisionish), `${file} still branches on a name`).not.toMatch(
        /kind\s*===\s*["'](Won|Lost)["']/,
      )
    }
  })

  it("gives every default pipeline exactly one WON and one LOST stage", () => {
    // A new workspace whose "Won" stage has kind OPEN would report no revenue
    // at all, forever, with nothing to indicate why.
    const defaults = read("lib/default-stages.ts")
    const blocks = defaults.match(/kind: "(OPEN|WON|LOST)"/g) ?? []
    expect(blocks.filter((b) => b === 'kind: "WON"').length).toBe(2)
    expect(blocks.filter((b) => b === 'kind: "LOST"').length).toBe(2)

    // And no default stage may lean on the database default.
    expect(defaults).not.toMatch(/color: "#[0-9a-f]{6}" \},\n/)
  })

  it("points all three stage-creating paths at the shared defaults", () => {
    for (const file of ["lib/actions/workspaces.ts", "lib/actions/auth.ts"]) {
      expect(read(file), `${file} declares its own stage list`).toMatch(
        /from "@\/lib\/default-stages"/,
      )
      expect(strip(read(file)), `${file} declares its own stage list`).not.toMatch(
        /const DEFAULT_STAGES = \[/,
      )
    }
    expect(read("prisma/seed.ts")).toMatch(/from "\.\.\/lib\/default-stages"/)
  })

  it("makes stage kind editable, because the backfill is only an inference", () => {
    const manager = read("components/deals/stage-manager.tsx")
    expect(manager).toMatch(/setKind\(v as StageKind\)/)
    expect(manager).toMatch(/value="WON"/)
    expect(manager).toMatch(/value="LOST"/)
    expect(read("lib/validators.ts")).toMatch(/kind: z\.enum\(\["OPEN", "WON", "LOST"\]\)/)
  })

  it("declares the enum and keeps it non-null with a default", () => {
    const schema = read("prisma/schema.prisma")
    expect(schema).toMatch(/enum StageKind \{[\s\S]*?OPEN[\s\S]*?WON[\s\S]*?LOST[\s\S]*?\}/)
    expect(schema).toMatch(/kind\s+StageKind\s+@default\(OPEN\)/)
  })
})

describe("chart tooltip formatting", () => {
  it("formats the won-chart tooltip with the same formatter as the axis", () => {
    // The library renders `value.toLocaleString()` when no formatter is given,
    // so an unformatted money series shows `107600000` under an axis reading
    // `₹10.8 Cr` and the hover looks like a different number.
    const charts = read("components/dashboard/charts.tsx")
    expect(charts).toMatch(/<EvilAreaChart\.Tooltip[\s\S]*?valueFormatter=\{\(value\) => formatMoneyShort\(value, currency\)\}/)
    expect(charts).toMatch(/tickFormatter=\{\(value: number\) => formatMoneyShort\(value, currency\)\}/)
  })

  it("exposes a valueFormatter on the library tooltip instead of hard-coding toLocaleString", () => {
    const area = read("components/evilcharts/charts/recharts-area-chart.tsx")
    expect(area).toMatch(/valueFormatter\?: \(value: number, name: string\) => string/)
    expect(area).toMatch(/formatter=\{[\s\S]*?valueFormatter\(Number\(value\), String\(name\)\)/)
  })
})
