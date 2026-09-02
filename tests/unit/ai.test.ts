import { describe, it, expect } from "vitest"
import { suggestActions } from "@/modules/ai/suggest"
import { scheduleFollowUps } from "@/modules/ai/scheduler"
import { draftMessage } from "@/modules/ai/drafting"
import { analyzeCall } from "@/modules/ai/analyze"
import { revenueForecast, collectionForecast, stageProbability } from "@/modules/ai/forecast"

describe("suggestActions", () => {
  it("returns 3 ranked actions with reasoning", () => {
    const rows = suggestActions({ leadScore: 80, bookingStage: "INQUIRY", daysSinceLastActivity: 3, hasPhone: true })
    expect(rows).toHaveLength(3)
    expect(rows[0].reason).toBeTruthy()
    expect(rows[0].priority).toBeGreaterThanOrEqual(rows[1].priority)
  })
  it("nudges when idle >=4", () => {
    const rows = suggestActions({ daysSinceLastActivity: 5, leadScore: 30 })
    expect(rows.some((r) => r.action === "NUDGE")).toBe(true)
  })
  it("HOT INQUIRY surfaces CALL first", () => {
    const rows = suggestActions({ leadScore: 90, bookingStage: "INQUIRY", hasPhone: true })
    expect(rows[0].action).toBe("CALL")
  })
})

describe("scheduleFollowUps", () => {
  it("creates 3 activities with future scheduledAt per band", () => {
    const now = new Date("2026-09-01T00:00:00Z")
    const rows = scheduleFollowUps({ leadScore: 85, now })
    expect(rows).toHaveLength(3)
    expect(rows[0].scheduledAt.getTime()).toBeGreaterThan(now.getTime())
    expect(rows[0].type).toBe("CALL")
  })
  it("cold band is slower", () => {
    const now = new Date("2026-09-01T00:00:00Z")
    const hot = scheduleFollowUps({ leadScore: 90, now })
    const cold = scheduleFollowUps({ leadScore: 10, now })
    expect(cold[0].scheduledAt.getTime()).toBeGreaterThan(hot[0].scheduledAt.getTime())
  })
})

describe("draftMessage", () => {
  it("renders each intent", () => {
    expect(draftMessage({ intent: "lead_ack", contactName: "Asha", projectName: "Sunrise" })).toContain("Asha")
    expect(draftMessage({ intent: "cost_sheet", unitNo: "A-101", amount: 5000000 })).toContain("A-101")
    expect(draftMessage({ intent: "visit_reminder", contactName: "Bo" })).toContain("site visit")
  })
})

describe("analyzeCall", () => {
  it("extracts config, budget, sentiment", () => {
    const a = analyzeCall("Looking for 2 BHK, budget 55 lakh to 70 lakh, possession in 8 months. Love the location!")
    expect(a.config).toBe("BHK2")
    expect(a.budgetMin).toBeGreaterThan(0)
    expect(a.budgetMax).toBeGreaterThan(a.budgetMin!)
    expect(a.possessionMonths).toBe(8)
    expect(a.sentiment).toBe("positive")
  })
  it("negative sentiment", () => {
    const a = analyzeCall("Angry about delay, want refund")
    expect(a.sentiment).toBe("negative")
  })
})

describe("forecast", () => {
  it("stageProbability", () => {
    expect(stageProbability("INQUIRY")).toBe(0.05)
    expect(stageProbability("BOOKING")).toBeGreaterThan(0.5)
    expect(stageProbability("CLOSED")).toBe(1)
  })
  it("revenueForecast weights by prob", () => {
    const r = revenueForecast([
      { bookingStage: "INQUIRY", value: 1000000 },
      { bookingStage: "BOOKING", value: 1000000 },
    ])
    expect(r.pipeline).toBe(2000000)
    expect(r.weighted).toBeGreaterThan(0)
    expect(r.weighted).toBeLessThan(r.pipeline)
  })
  it("collectionForecast overdue vs due30", () => {
    const now = new Date("2026-09-02T00:00:00Z")
    const c = collectionForecast(
      [
        { status: "DUE", amount: 100, dueDate: "2026-08-01T00:00:00Z" },
        { status: "DUE", amount: 200, dueDate: "2026-09-10T00:00:00Z" },
        { status: "PAID", amount: 999, dueDate: null },
      ],
      now,
    )
    expect(c.overdue).toBe(100)
    expect(c.due30).toBe(200)
    expect(c.nextDueDate).toBe("2026-09-10")
  })
})
