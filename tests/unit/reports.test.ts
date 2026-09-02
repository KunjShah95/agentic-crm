import { describe, it, expect } from "vitest"
import { funnel, inventoryHealth, collections, sourceROI, teamVsTarget } from "@/modules/reports/aggregate"

describe("funnel", () => {
  it("counts deals per stage in canonical RE order", () => {
    const rows = funnel([
      { bookingStage: "INQUIRY" },
      { bookingStage: "VISIT" },
      { bookingStage: "BOOKING" },
    ])
    expect(rows.map((r) => r.stage)).toEqual([
      "INQUIRY",
      "VISIT",
      "NEGOTIATION",
      "HOLD",
      "BOOKING",
      "REGISTRATION",
      "POSSESSION",
      "CLOSED",
    ])
  })

  it("computes conversionPct against the INQUIRY count, rounded 1 decimal", () => {
    const rows = funnel([
      { bookingStage: "INQUIRY" },
      { bookingStage: "INQUIRY" },
      { bookingStage: "INQUIRY" },
      { bookingStage: "VISIT" },
      { bookingStage: "BOOKING" },
    ])
    const byStage = Object.fromEntries(rows.map((r) => [r.stage, r]))
    expect(byStage.INQUIRY.count).toBe(3)
    expect(byStage.INQUIRY.conversionPct).toBe(100)
    expect(byStage.VISIT.count).toBe(1)
    expect(byStage.VISIT.conversionPct).toBe(33.3)
    expect(byStage.BOOKING.conversionPct).toBe(33.3)
  })

  it("treats null stage as INQUIRY", () => {
    const rows = funnel([{ bookingStage: null }, { bookingStage: null }])
    const inquiry = rows.find((r) => r.stage === "INQUIRY")!
    expect(inquiry.count).toBe(2)
  })

  it("yields 0 conversionPct everywhere when there are no INQUIRY deals", () => {
    const rows = funnel([])
    for (const r of rows) {
      expect(r.count).toBe(0)
      expect(r.conversionPct).toBe(0)
    }
  })
})

describe("inventoryHealth", () => {
  it("counts units by status", () => {
    const h = inventoryHealth([
      { status: "AVAILABLE" },
      { status: "AVAILABLE" },
      { status: "HOLD" },
      { status: "BOOKED" },
      { status: "SOLD" },
    ])
    expect(h).toMatchObject({ total: 5, available: 2, hold: 1, booked: 1, sold: 1 })
  })

  it("computes soldPct as (booked+sold)/total rounded 1 decimal", () => {
    const h = inventoryHealth([
      { status: "BOOKED" },
      { status: "SOLD" },
      { status: "AVAILABLE" },
    ])
    expect(h.soldPct).toBe(66.7)
  })

  it("returns zeros and 0 soldPct on empty input", () => {
    const h = inventoryHealth([])
    expect(h).toEqual({ total: 0, available: 0, hold: 0, booked: 0, sold: 0, soldPct: 0 })
  })
})

describe("collections", () => {
  it("sums amounts by status", () => {
    const c = collections([
      { status: "DUE", amount: 100 },
      { status: "PAID", amount: 200 },
      { status: "OVERDUE", amount: 50 },
    ])
    expect(c).toMatchObject({ due: 100, paid: 200, overdue: 50, total: 350 })
  })

  it("promotes a DUE payment past its dueDate to OVERDUE", () => {
    const now = new Date("2026-09-02T00:00:00Z")
    const c = collections(
      [
        { status: "DUE", amount: 100, dueDate: "2026-08-01T00:00:00Z" },
        { status: "DUE", amount: 40, dueDate: "2026-12-01T00:00:00Z" },
      ],
      now,
    )
    expect(c.overdue).toBe(100)
    expect(c.due).toBe(40)
    expect(c.total).toBe(140)
  })

  it("computes overduePct rounded 1 decimal", () => {
    const c = collections([
      { status: "OVERDUE", amount: 1 },
      { status: "PAID", amount: 2 },
    ])
    expect(c.overduePct).toBe(33.3)
  })

  it("returns 0 overduePct when total is 0", () => {
    const c = collections([])
    expect(c).toEqual({ due: 0, paid: 0, overdue: 0, total: 0, overduePct: 0 })
  })
})

describe("sourceROI", () => {
  it("groups by source with leads, bookings, revenue and conversionPct", () => {
    const rows = sourceROI([
      { source: "META", isBooking: true, revenue: 1000 },
      { source: "META", isBooking: false, revenue: 0 },
      { source: "META", isBooking: false, revenue: 0 },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      source: "META",
      leads: 3,
      bookings: 1,
      revenue: 1000,
      conversionPct: 33.3,
    })
  })

  it("sorts by revenue descending", () => {
    const rows = sourceROI([
      { source: "GOOGLE", isBooking: true, revenue: 500 },
      { source: "META", isBooking: true, revenue: 2000 },
      { source: "WEBSITE", isBooking: false, revenue: 100 },
    ])
    expect(rows.map((r) => r.source)).toEqual(["META", "GOOGLE", "WEBSITE"])
  })
})

describe("teamVsTarget", () => {
  it("computes attainmentPct rounded 1 decimal", () => {
    const rows = teamVsTarget([
      { ownerId: "u1", ownerName: "Asha", bookings: 1, target: 3 },
    ])
    expect(rows[0].attainmentPct).toBe(33.3)
  })

  it("guards target 0 with 0 attainmentPct", () => {
    const rows = teamVsTarget([
      { ownerId: "u1", ownerName: "Asha", bookings: 5, target: 0 },
    ])
    expect(rows[0].attainmentPct).toBe(0)
  })

  it("sorts by attainmentPct descending", () => {
    const rows = teamVsTarget([
      { ownerId: "u1", ownerName: "Asha", bookings: 1, target: 10 },
      { ownerId: "u2", ownerName: "Bo", bookings: 9, target: 10 },
      { ownerId: "u3", ownerName: "Cy", bookings: 5, target: 10 },
    ])
    expect(rows.map((r) => r.ownerId)).toEqual(["u2", "u3", "u1"])
  })
})
