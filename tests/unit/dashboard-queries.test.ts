import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Dashboard rollup correctness.
 *
 * Every number on the dashboard is a rollup over deal *rows*, so three classes
 * of bug are invisible from the page and only show up here:
 *
 *  1. **Currency.** `Deal.currency` is per-deal and there is no workspace-level
 *     currency and no FX table anywhere in the codebase. Summing INR and CAD
 *     into one rupee total is not a rounding error, it is a fabricated number.
 *  2. **Window scope.** `units` was summed over `recentProjects`, which is
 *     `take: 4` — so any workspace with more than four projects undercounted.
 *  3. **Counts vs sums.** A CAD deal is still a deal in Negotiation, so counts
 *     must include it even though its value cannot be summed.
 *
 * The real DB suite (`tests/integration/db.test.ts`) is skipped without a live
 * Postgres, which is exactly where these would otherwise be caught.
 */

const db = vi.hoisted(() => ({
  contact: { count: vi.fn(), groupBy: vi.fn() },
  deal: { count: vi.fn(), findMany: vi.fn() },
  project: { count: vi.fn(), findMany: vi.fn() },
  siteVisit: { count: vi.fn() },
  activity: { count: vi.fn(), findMany: vi.fn() },
  pipelineStage: { findMany: vi.fn() },
  unit: { count: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))

import { getDashboardData, reportingCurrency } from "@/modules/dashboard/queries"
import type { StageKind } from "@/lib/pipeline-stages"

const STAGES = [
  { id: "st-proposal", name: "Proposal", kind: "OPEN" as StageKind, order: 0 },
  { id: "st-negotiation", name: "Negotiation", kind: "OPEN" as StageKind, order: 1 },
  { id: "st-won", name: "Won", kind: "WON" as StageKind, order: 2 },
]

/** A date inside the six-month window the chart buckets over. */
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

type NarrowDeal = {
  stageId: string
  value: number | null
  probability: number | null
  updatedAt: Date
  wonAt?: Date | null
  currency: string
  stage: { name: string; kind: StageKind }
}

function seed(deals: NarrowDeal[], units = 68) {
  db.contact.count.mockResolvedValue(50)
  db.deal.count.mockResolvedValue(deals.length)
  db.project.count.mockResolvedValue(5)
  db.siteVisit.count.mockResolvedValue(9)
  db.activity.count.mockResolvedValue(4)
  db.unit.count.mockResolvedValue(units)
  db.pipelineStage.findMany.mockResolvedValue(STAGES)
  db.contact.groupBy.mockResolvedValue([])
  // Call 1 is the narrow rollup select, call 2 is `getTopDeals`.
  db.deal.findMany.mockResolvedValueOnce(deals).mockResolvedValueOnce([])
  db.activity.findMany.mockResolvedValue([])
  db.project.findMany.mockResolvedValue([])
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("reportingCurrency", () => {
  it("falls back to INR when a workspace has no deals", () => {
    expect(reportingCurrency([])).toBe("INR")
  })

  it("picks the currency most deals are held in", () => {
    expect(
      reportingCurrency([
        { currency: "INR", value: 100 },
        { currency: "INR", value: 100 },
        { currency: "CAD", value: 900 },
      ]),
    ).toBe("INR")
  })

  it("breaks a deal-count tie on total value, then alphabetically", () => {
    // One deal each, so value decides: the CAD deal carries more.
    expect(
      reportingCurrency([
        { currency: "INR", value: 100 },
        { currency: "CAD", value: 900 },
      ]),
    ).toBe("CAD")
    // Identical both ways — must be stable, not dependent on input order.
    expect(
      reportingCurrency([
        { currency: "INR", value: 100 },
        { currency: "CAD", value: 100 },
      ]),
    ).toBe("CAD")
    expect(
      reportingCurrency([
        { currency: "CAD", value: 100 },
        { currency: "INR", value: 100 },
      ]),
    ).toBe("CAD")
  })

  it("treats an empty currency string as INR", () => {
    expect(reportingCurrency([{ currency: "", value: 1 }])).toBe("INR")
  })
})

describe("getDashboardData currency scoping", () => {
  it("excludes foreign-currency values from sums but not from counts", async () => {
    seed([
      { stageId: "st-proposal", value: 25_000_000, probability: 60, updatedAt: daysAgo(3), currency: "INR", stage: { name: "Proposal", kind: "OPEN" } },
      { stageId: "st-negotiation", value: 25_000_000, probability: 80, updatedAt: daysAgo(3), currency: "INR", stage: { name: "Negotiation", kind: "OPEN" } },
      { stageId: "st-negotiation", value: 500_000, probability: 40, updatedAt: daysAgo(3), currency: "CAD", stage: { name: "Negotiation", kind: "OPEN" } },
    ])

    const data = await getDashboardData("w1")

    expect(data.currency).toBe("INR")
    // 25M + 25M. Adding the CAD 500k would be a fabricated rupee total.
    expect(data.openPipeline).toBe(50_000_000)
    expect(data.foreignCurrencyDeals).toBe(1)
    // Three open deals, all three counted — a CAD deal is still a deal.
    expect(data.counts.openDeals).toBe(3)
    // (60x25M + 80x25M) / 50M = 70. The CAD deal's 40 must not be blended in.
    expect(data.winProbability).toBe(70)
  })

  it("reports a workspace whose only deals are foreign as its own currency", async () => {
    // The `qwertyu` case: one CAD deal rendering as a rupee figure.
    seed([
      { stageId: "st-negotiation", value: 563_578, probability: 34, updatedAt: daysAgo(2), currency: "CAD", stage: { name: "Negotiation", kind: "OPEN" } },
    ])

    const data = await getDashboardData("w1")

    expect(data.currency).toBe("CAD")
    expect(data.openPipeline).toBe(563_578)
    expect(data.foreignCurrencyDeals).toBe(0)
  })

  it("keeps a won deal's count while excluding its value when it is foreign", async () => {
    seed([
      { stageId: "st-won", value: 10_000_000, probability: 100, updatedAt: daysAgo(5), currency: "INR", stage: { name: "Won", kind: "WON" } },
      { stageId: "st-won", value: 700_000, probability: 100, updatedAt: daysAgo(5), currency: "CAD", stage: { name: "Won", kind: "WON" } },
    ])

    const data = await getDashboardData("w1")

    expect(data.counts.wonDeals).toBe(2)
    const bucket = data.wonByMonth.find((m) => m.count > 0)
    expect(bucket?.count).toBe(2)
    expect(bucket?.value).toBe(10_000_000)
  })
})

describe("getDashboardData window scope", () => {
  it("counts units across every project, not the four most recent", async () => {
    seed([], 68)

    const data = await getDashboardData("w1")

    expect(db.unit.count).toHaveBeenCalledWith({ where: { workspaceId: "w1" } })
    expect(data.counts.units).toBe(68)
  })

  it("drops won deals touched before the six-month window from the series", async () => {
    seed([
      { stageId: "st-won", value: 10_000_000, probability: 100, updatedAt: daysAgo(10), currency: "INR", stage: { name: "Won", kind: "WON" } },
      { stageId: "st-won", value: 99_000_000, probability: 100, updatedAt: daysAgo(200), currency: "INR", stage: { name: "Won", kind: "WON" } },
    ])

    const data = await getDashboardData("w1")

    // All-time won still counts both...
    expect(data.counts.wonDeals).toBe(2)
    // ...but only the in-window one is plotted.
    expect(data.wonByMonth).toHaveLength(6)
    expect(data.wonByMonth.reduce((s, m) => s + m.value, 0)).toBe(10_000_000)
    expect(data.wonByMonth.reduce((s, m) => s + m.count, 0)).toBe(1)
  })
})

/**
 * `wonAt` bucketing.
 *
 * The regression: revenue was bucketed by `updatedAt`, which moves on every
 * edit. Renaming a won deal moved its full value into the current month, so the
 * trend chart could be made to say anything by typing in a field — and a seeded
 * or imported row always landed in the month the import ran, which is why the
 * kunjshah workspace showed one spike and five empty months.
 */
describe("getDashboardData won-at bucketing", () => {
  it("buckets by wonAt, ignoring a much newer updatedAt", async () => {
    // Won four months ago, edited yesterday. Under the old proxy this plotted
    // in the current month.
    seed([
      {
        stageId: "st-won",
        value: 50_000_000,
        probability: 100,
        updatedAt: daysAgo(1),
        wonAt: daysAgo(120),
        currency: "INR",
        stage: { name: "Won", kind: "WON" },
      },
    ])

    const data = await getDashboardData("w1")

    const plotted = data.wonByMonth.filter((m) => m.value > 0)
    expect(plotted).toHaveLength(1)
    expect(plotted[0].value).toBe(50_000_000)
    // Four months back from a six-month window is the second bucket, not the last.
    expect(plotted[0].month).not.toBe(data.wonByMonth.at(-1)?.month)
  })

  it("splits deals won in different months across their own buckets", async () => {
    seed([
      { stageId: "st-won", value: 10_000_000, probability: 100, updatedAt: daysAgo(1), wonAt: daysAgo(20), currency: "INR", stage: { name: "Won", kind: "WON" } },
      { stageId: "st-won", value: 20_000_000, probability: 100, updatedAt: daysAgo(1), wonAt: daysAgo(80), currency: "INR", stage: { name: "Won", kind: "WON" } },
    ])

    const data = await getDashboardData("w1")

    const plotted = data.wonByMonth.filter((m) => m.value > 0)
    expect(plotted).toHaveLength(2)
    expect(plotted.reduce((s, m) => s + m.value, 0)).toBe(30_000_000)
    // A shared `updatedAt` must not collapse them into one bucket.
    expect(new Set(plotted.map((m) => m.month)).size).toBe(2)
  })

  it("falls back to updatedAt when wonAt is null (closed before the column existed)", async () => {
    seed([
      { stageId: "st-won", value: 10_000_000, probability: 100, updatedAt: daysAgo(15), wonAt: null, currency: "INR", stage: { name: "Won", kind: "WON" } },
    ])

    const data = await getDashboardData("w1")

    expect(data.wonByMonth.reduce((s, m) => s + m.value, 0)).toBe(10_000_000)
  })

  it("excludes a wonAt older than the six-month window", async () => {
    seed([
      { stageId: "st-won", value: 99_000_000, probability: 100, updatedAt: daysAgo(2), wonAt: daysAgo(400), currency: "INR", stage: { name: "Won", kind: "WON" } },
    ])

    const data = await getDashboardData("w1")

    // Counted all-time, plotted nowhere — which is the honest split for a win
    // that predates the window.
    expect(data.counts.wonDeals).toBe(1)
    expect(data.wonByMonth.reduce((s, m) => s + m.value, 0)).toBe(0)
  })

  it("ignores wonAt on deals that are not in the Won stage", async () => {
    // A stale stamp left behind by a reopen must not pull a deal into revenue.
    seed([
      { stageId: "st-neg", value: 40_000_000, probability: 70, updatedAt: daysAgo(2), wonAt: daysAgo(10), currency: "INR", stage: { name: "Negotiation", kind: "OPEN" } },
    ])

    const data = await getDashboardData("w1")

    expect(data.counts.wonDeals).toBe(0)
    expect(data.wonByMonth.reduce((s, m) => s + m.value, 0)).toBe(0)
    // It still counts as open pipeline.
    expect(data.openPipeline).toBe(40_000_000)
  })
})