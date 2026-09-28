"use client"

import * as React from "react"

import { EvilAreaChart } from "@/components/evilcharts/charts/recharts-area-chart"
import { EvilBarChart } from "@/components/evilcharts/charts/recharts-bar-chart"
import { EvilPieChart } from "@/components/evilcharts/charts/recharts-pie-chart"
import { EvilRadialChart } from "@/components/evilcharts/charts/recharts-radial-chart"
import { formatMoneyShort } from "@/lib/format"

/**
 * The four dashboard charts.
 *
 * The chart *components* come from EvilCharts; almost every visual decision
 * here is an override of them, and each override exists because of a specific
 * way the library's defaults break on a monochrome, fixed-height panel:
 *
 *  - **`aspect-auto` on every root.** `ChartContainer` hard-codes
 *    `aspect-video` on a chart with no footer, which derives the height from the
 *    width. In a 746px-wide column that is a 420px-tall chart inside a 228px
 *    box: the axis renders, the plot is clipped halfway, and it looks like a
 *    rendering bug rather than a sizing one. `aspect-auto` (via `twMerge`)
 *    cancels it so the panel's own height wins.
 *  - **`animationType="none"` on both animated charts.** The library's intro is
 *    a `motion` element seeded at `scaleX: 0` / `scaleY: 0`. Server-rendered,
 *    and for the first frames after hydration, that seed is what actually
 *    paints — so the bars and the area are *genuinely invisible* until the
 *    animation runs. A chart that is blank before JS settles is a worse trade
 *    than a chart that simply appears.
 *  - **Flat fills instead of the gradient patterns.** The library's fills are a
 *    10%-opacity fade masked into the series colour, which is tuned for a
 *    saturated palette on a dark surface. On black-and-white it reads as
 *    "nothing is here". The area gets a flat `var(--foreground)` wash and the
 *    bar gets the library's solid default, both of which are legible.
 *  - **The donut's config keys are the sector names, verbatim.** The library
 *    builds each sector's fill as `url(#<id>-colors-<nameKey value>)` and
 *    defines those gradients from the *config keys*. If the two differ, the
 *    reference points at a gradient that does not exist and the sector paints
 *    with the SVG default (black). So the row's `name` is the escaped key and
 *    the human label is carried separately — see `safeName`.
 */

const RAMP_LIGHT = ["#0d0d0d", "#3d3d3d", "#6b6b6b", "#949494", "#bcbcbc", "#dedede"]
const RAMP_DARK = ["#f2f2f2", "#c6c6c6", "#9a9a9a", "#717171", "#4d4d4d", "#2e2e2e"]

const INK_LIGHT = ["#0d0d0d"]
const INK_DARK = ["#f2f2f2"]

/** Cancels the library's `aspect-video` so the panel's height governs. */
const FIT = "h-full aspect-auto"

const AXIS = { fontSize: 10, fontWeight: 700 } as const
const GRID = "var(--hairline)"

/** Rupee → short form, for axis ticks. `formatMoneyShort` gives ₹4.2 Cr / ₹35 L. */
const moneyTick = (value: number) => formatMoneyShort(value)

/* ── Won revenue, six months ─────────────────────────────────────────────── */

export function WonRevenueChart({
  data,
}: {
  data: { label: string; value: number; count: number }[]
}) {
  // A flat-zero series is the one case where a chart actively misleads: a
  // filled area along the floor implies "we tracked this and it was zero",
  // which is a different claim from "no deals have been won yet". Say it.
  if (data.every((d) => d.value === 0)) {
    return <ChartBlank message="No deals in the Won stage yet — this fills in as you close them." />
  }

  const config = {
    won: { label: "Won value", colors: { light: INK_LIGHT, dark: INK_DARK } },
  }

  return (
    <div className="h-full min-h-[200px]">
      <EvilAreaChart
        className={FIT}
        config={config}
        // The config key is the series name and the chart validates that every
        // config key exists on the row type, so the rows carry `won`.
        data={data.map((d) => ({ label: d.label, won: d.value, count: d.count }))}
        curveType="monotone"
        animationType="none"
        chartProps={{ margin: { top: 8, right: 10, bottom: 0, left: 0 } }}
      >
        <EvilAreaChart.Grid strokeDasharray="2 4" stroke={GRID} />
        <EvilAreaChart.XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ ...AXIS, fill: "var(--muted-foreground)" }}
        />
        <EvilAreaChart.YAxis
          // Pinned to zero. Recharts would otherwise pick a domain from the data
          // alone, and a single winning month would have that month fill the
          // whole plot height — which exaggerates it enormously.
          domain={[0, "auto"]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={52}
          tickFormatter={moneyTick}
          tick={{ ...AXIS, fill: "var(--muted-foreground)" }}
        />
        <EvilAreaChart.Area
          dataKey="won"
          variant="gradient"
          strokeVariant="solid"
          strokeWidth={1.6}
          // Overrides the library's 10% fade pattern. `--foreground` is
          // near-black in light and near-white in dark, so the wash follows the
          // theme without a second colour decision.
          areaProps={{ dataKey: "won", fill: "var(--foreground)", fillOpacity: 0.09 }}
        >
          <EvilAreaChart.Dot variant="border" />
        </EvilAreaChart.Area>
        <EvilAreaChart.Tooltip cursor />
      </EvilAreaChart>
    </div>
  )
}

/* ── Win probability gauge ───────────────────────────────────────────────── */

export function WinProbabilityGauge({ value }: { value: number | null }) {
  if (value == null) {
    return <ChartBlank message="No open deal carries a win probability yet." />
  }

  const config = {
    probability: {
      label: "Weighted win probability",
      colors: { light: INK_LIGHT, dark: INK_DARK },
    },
  }

  return (
    // Square. A radial chart in a 340×190 box draws a 190px circle centred in
    // 340px of space, which leaves the gauge floating in dead width.
    <div className="relative mx-auto aspect-square h-[168px] w-[168px]">
      <EvilRadialChart
        className={FIT}
        config={config}
        data={[{ name: "probability", value }]}
        nameKey="name"
        // The fixed 0–100 domain is the entire point of a gauge: without it the
        // arc auto-scales so the single value fills it, and 4% looks identical
        // to 94%.
        max={100}
        innerRadius="74%"
        outerRadius="100%"
      >
        <EvilRadialChart.RadialBar dataKey="value" cornerRadius={999} barSize={10} />
      </EvilRadialChart>

      {/* Centre readout as an overlay rather than inside the chart, so the
          number is real DOM text — selectable, and never clipped or rescaled
          by the responsive container. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[34px] leading-none font-bold tracking-[-0.04em] tabular-nums text-foreground">
          {value}
          <span className="text-[17px] tracking-[-0.02em] text-muted-foreground">%</span>
        </span>
        <span className="mt-1.5 text-[9.5px] font-bold tracking-[0.12em] uppercase text-muted-foreground">
          Weighted
        </span>
      </div>
    </div>
  )
}

/* ── Pipeline by stage ───────────────────────────────────────────────────── */

export function PipelineByStageChart({
  data,
}: {
  data: { name: string; count: number; value: number }[]
}) {
  if (data.every((d) => d.count === 0)) {
    return <ChartBlank message="No deals in the pipeline yet." />
  }

  const config = {
    count: { label: "Deals", colors: { light: INK_LIGHT, dark: INK_DARK } },
  }

  return (
    /*
     * `h-full` is what makes the chart absorb the panel's extra height. The
     * wrapper is `flex-1`, so `h-full` resolves against a stretched box rather
     * than a hard-coded one — which is what removed the dead white band under
     * the bars.
     *
     * `min-h-[190px]` is the floor: below that, six stage labels plus the value
     * axis stop being legible and recharts starts overlapping them.
     */
    <div className="h-full min-h-[190px]">
      {/*
        `layout="horizontal"` on the *library* is what produces horizontal bars
        here, and the axis pairing below is not optional — it is a consequence.

        The library passes `layout` to recharts inverted (`isHorizontal ? "vertical"
        : "horizontal"`), and in recharts a chart's layout names the axis the
        *category* axis lives on: `vertical` puts categories on Y, `horizontal`
        puts them on X. `computeBarRectangles` then calls
        `getCateCoordinateOfBar({ axis })` against the category axis and returns
        `null` for every entry when the axes are swapped — which produces a
        chart with a correct-looking pair of axes, a correct-looking scale, and
        absolutely no bars, and no warning of any kind.

        So: library `horizontal` → recharts `vertical` → categories on Y, values
        on X. Stage names are words, and words read down a left-hand axis, which
        is the other half of why this is horizontal rather than six columns.
      */}
      <EvilBarChart
        className={FIT}
        config={config}
        data={data}
        layout="horizontal"
        barRadius={3}
        animationType="none"
        chartProps={{ margin: { top: 4, right: 18, bottom: 0, left: 0 } }}
      >
        <EvilBarChart.XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          allowDecimals={false}
          tick={{ ...AXIS, fill: "var(--muted-foreground)" }}
        />
        <EvilBarChart.YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          width={70}
          tick={{ ...AXIS, fill: "var(--foreground)" }}
        />
        {/*
          `barSize` goes through the library's `barProps` escape hatch — the
          chart component has no top-level prop for it, and `barRadius` alone
          cannot reach the recharts `<Bar>`.

          Without it, recharts sizes a categorical bar as a fraction of the band
          width and fills most of the slot. With six stages across ~420px that
          is ~40px of black per bar, so the rows visually merge into one block
          and the gaps that separate the stages disappear. 10px lets the
          whitespace do the separating, which is what makes six rows read as
          six rows instead of one shape.
        */}
        <EvilBarChart.Bar dataKey="count" variant="default" barProps={{ barSize: 10 }} />
      </EvilBarChart>
    </div>
  )
}

/* ── Lead source mix ─────────────────────────────────────────────────────── */

export function LeadSourceDonut({ data }: { data: { source: string; count: number }[] }) {
  const [hover, setHover] = React.useState<{ row: DonutRow; x: number; y: number } | null>(null)

  /*
   * The row's `name` IS the config key, because the library derives each
   * sector's gradient id from the nameKey value and defines the gradient from
   * the config key. They have to be the same string or the `url(#…)` reference
   * dangles and every sector paints with the SVG default. The display label is
   * therefore kept in a parallel column and rendered by the list below.
   */
  const rows: DonutRow[] = data.map((slice, i) => ({
    name: safeName(slice.source),
    label: slice.source,
    value: slice.count,
    color: `var(--color-${safeName(slice.source)}-0, ${RAMP_LIGHT[i % RAMP_LIGHT.length]})`,
  }))

  const config = Object.fromEntries(
    rows.map((row, i) => [
      row.name,
      {
        label: row.label,
        colors: {
          light: [RAMP_LIGHT[i % RAMP_LIGHT.length]],
          dark: [RAMP_DARK[i % RAMP_DARK.length]],
        },
      },
    ])
  )

  const total = rows.reduce((s, r) => s + r.value, 0)

  /**
   * Hover is resolved from pointer geometry rather than from the chart's own
   * tooltip.
   *
   * The library's pie tooltip is hard-coded to `hideLabel`, so it can only ever
   * show a bare number — and with the sector names escaped for the gradient ids,
   * that number is unlabelled and therefore useless. Worse, the library renders
   * each sector through a custom `shape`, and recharts only wires its tooltip to
   * a sector if the shape forwards the hover handlers, so a stock `<Tooltip>`
   * never fires at all here.
   *
   * Doing the hit-test by hand is ~10 lines and cannot silently break: the pie
   * is a full 0–360° sweep starting at 12 o'clock and running clockwise, so the
   * pointer's angle off the centre is proportional to the cumulative share.
   */
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const el = event.currentTarget
    const rect = el.getBoundingClientRect()
    // The pie is centred in a square and recharts caps the radius at half the
    // shorter side, so the geometry is derivable from the box alone.
    const cx = rect.width / 2
    const cy = rect.height / 2
    const dx = event.clientX - rect.left - cx
    const dy = event.clientY - rect.top - cy
    const r = Math.hypot(dx, dy)
    const outer = cx
    const inner = outer * 0.66

    if (r > outer || r < inner || total === 0) {
      setHover(null)
      return
    }

    // 0° at 12 o'clock, increasing clockwise — recharts' convention.
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (deg < 0) deg += 360
    const fraction = deg / 360

    let acc = 0
    for (const row of rows) {
      acc += row.value / total
      if (fraction <= acc) {
        setHover({ row, x: event.clientX - rect.left, y: event.clientY - rect.top })
        return
      }
    }
    setHover(null)
  }

  if (data.length === 0) {
    return <ChartBlank message="No lead source recorded on any contact yet." />
  }

  return (
    <div>
      <div
        className="relative mx-auto aspect-square h-[164px] w-[164px]"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
      >
        <EvilPieChart
          className={FIT}
          config={config}
          data={rows}
          dataKey="value"
          nameKey="name"
          chartProps={{ margin: { top: 0, right: 0, bottom: 0, left: 0 } }}
        >
          <EvilPieChart.Pie
            variant="gradient"
            innerRadius="66%"
            outerRadius="100%"
            cornerRadius={2}
            paddingAngle={1.4}
            isClickable
          />
        </EvilPieChart>

        {hover ? (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-sm bg-primary px-2.5 py-1.5 shadow-lg"
            style={{ left: hover.x, top: hover.y }}
          >
            <p className="text-[11.5px] leading-4 font-bold tracking-[-0.01em] whitespace-nowrap text-primary-foreground">
              {hover.row.label}
            </p>
            <p className="mt-0.5 text-[11px] leading-4 tabular-nums whitespace-nowrap text-primary-foreground/70">
              {hover.row.value} {hover.row.value === 1 ? "contact" : "contacts"}
              {total > 0 ? ` · ${Math.round((hover.row.value / total) * 100)}%` : null}
            </p>
          </div>
        ) : null}
      </div>

      {/*
        This list replaces the library's legend on purpose. A legend of six grey
        swatches in a column is unreadable — #949494 and #bcbcbc are not
        distinguishable at 10px — and this panel is too narrow for a horizontal
        one. A ranked list that spells out the count and the share is readable at
        any size, doubles as the "what is this donut telling me" explanation, and
        keeps the chart itself small enough to sit beside a text list.
      */}
      <ul className="mt-4 space-y-px">
        {rows.map((row) => (
          <li
            key={row.name}
            onPointerEnter={() => setHover({ row, x: 82, y: 0 })}
            onPointerLeave={() => setHover(null)}
            className="flex items-center gap-2.5 rounded-xs py-[4px] text-[12.5px] transition-colors duration-150 hover:bg-surface-sunken"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-xs"
              style={{ backgroundColor: row.color }}
            />
            <span className="min-w-0 flex-1 truncate tracking-[-0.01em] text-foreground">
              {row.label}
            </span>
            <span className="font-bold tabular-nums text-foreground">{row.value}</span>
            <span className="w-9 text-right tabular-nums text-muted-foreground">
              {total > 0 ? Math.round((row.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type DonutRow = { name: string; label: string; value: number; color: string }

/**
 * The in-chart empty state.
 *
 * A chart with no data still occupies its box, and an empty grid looks like a
 * bug rather than an absence — the user cannot tell whether the query failed or
 * there is genuinely nothing. So the zero case never reaches the chart at all.
 */
function ChartBlank({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[168px] flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-hairline bg-surface-sunken px-6 text-center">
      {/* A flat rule with a single tick — the shape of a chart with nothing on it. */}
      <svg viewBox="0 0 40 16" className="h-4 w-10" fill="none" aria-hidden>
        <path d="M1 11.5h38" stroke="var(--muted-foreground)" strokeWidth="1.4" strokeOpacity="0.4" strokeLinecap="round" />
        <path d="M1 8.5v6" stroke="var(--muted-foreground)" strokeWidth="1.4" strokeOpacity="0.6" strokeLinecap="round" />
      </svg>
      <p className="max-w-[34ch] text-[12.5px] leading-relaxed text-muted-foreground text-pretty">{message}</p>
    </div>
  )
}

/**
 * A lead-source name reduced to something safe to use as an SVG fragment and a
 * CSS custom-property name. "Google Ads" has to become something that survives
 * `url(#…)` and `--color-…`.
 */
function safeName(source: string) {
  return `lead-${source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`
}
