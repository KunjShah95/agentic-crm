import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  deal: { findFirst: vi.fn(), update: vi.fn() },
  unit: { findFirst: vi.fn(), update: vi.fn() },
  paymentMilestone: { findMany: vi.fn() },
  payment: { create: vi.fn() },
  documentTemplate: { findFirst: vi.fn() },
  generatedDocument: { create: vi.fn() },
  workspace: { findUnique: vi.fn() },
  activity: { create: vi.fn() },
  contact: { findFirst: vi.fn(), update: vi.fn() },
  commissionRule: { create: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }) }))
vi.mock("@/lib/permissions", () => ({ requireWorkspaceMember: vi.fn().mockResolvedValue({ role: "ADMIN" }) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { confirmBooking } from "@/modules/booking/actions"
import { assignCommission } from "@/modules/brokers/actions"

const dealRow = {
  id: "d1",
  workspaceId: "w1",
  bookingStage: "HOLD",
  contactId: "c1",
  paymentPlanId: null,
  value: null,
  costSheet: { basePrice: 5_000_000, gst: 250_000, stampDuty: 300_000, total: 5_550_000 },
  unit: { id: "unit1", unitNo: "A-1201", carpetArea: 850, builtUp: 1100, price: 5_550_000, project: { name: "Sun Residency", reraNo: "RERA-GJ-1" } },
  contact: { firstName: "Ravi", lastName: "Patel" },
}

beforeEach(() => {
  Object.values(db).forEach((m) => Object.values(m).forEach((fn) => (fn as any).mockReset?.()))
  db.deal.findFirst.mockResolvedValue(dealRow)
  db.deal.update.mockResolvedValue({})
  db.unit.update.mockResolvedValue({})
  db.paymentMilestone.findMany.mockResolvedValue([])
  db.payment.create.mockResolvedValue({ id: "pay" })
  db.documentTemplate.findFirst.mockResolvedValue({ id: "tpl1", bodyHtml: "Demand {{buyer_name}} unit {{unit_no}} amount ₹{{demand_amount}} total ₹{{total}}" })
  db.workspace.findUnique.mockResolvedValue({ name: "Acme Realty", settingsJson: { rera: "RERA-GJ-1" } })
  db.generatedDocument.create.mockResolvedValue({ id: "gdoc1" })
  db.activity.create.mockResolvedValue({ id: "a1" })
})

describe("booking acceptance chain", () => {
  it("confirmBooking books unit → 8 CLP milestones → demand letter #1", async () => {
    const r = await confirmBooking({ workspaceId: "w1", dealId: "d1", unitId: "unit1" })

    // unit → BOOKED
    expect(db.unit.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "BOOKED" }) }))
    // deal → BOOKING
    expect(db.deal.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bookingStage: "BOOKING" }) }))
    // 8 payment rows summing to total
    expect(db.payment.create).toHaveBeenCalledTimes(8)
    const sum = db.payment.create.mock.calls.reduce((a, c) => a + c[0].data.amount, 0)
    expect(sum).toBe(5_550_000)
    // demand letter generated, no leftover placeholders
    expect(db.generatedDocument.create).toHaveBeenCalledOnce()
    const rendered = db.generatedDocument.create.mock.calls[0][0].data.renderedHtml
    expect(rendered).not.toContain("{{")
    expect(rendered).toContain("Ravi Patel")
    expect(r).toMatchObject({ milestones: 8, demandDocId: "gdoc1", total: 5_550_000 })
  })

  it("blocks a backward booking transition", async () => {
    db.deal.findFirst.mockResolvedValue({ ...dealRow, bookingStage: "POSSESSION" })
    await expect(confirmBooking({ workspaceId: "w1", dealId: "d1", unitId: "unit1" })).rejects.toThrow(/Cannot move booking/)
  })

  it("assignCommission derives amount from deal value and links CP to deal", async () => {
    db.deal.findFirst.mockResolvedValue(dealRow)
    db.deal.update.mockResolvedValue({})
    db.commissionRule.create.mockResolvedValue({ id: "cr1", amount: 111_000 })
    await assignCommission({ workspaceId: "w1", data: { dealId: "d1", brokerId: "cp1", pct: 2 } })
    expect(db.deal.update).toHaveBeenCalledWith(expect.objectContaining({ data: { brokerId: "cp1" } }))
    expect(db.commissionRule.create.mock.calls[0][0].data.amount).toBe(111_000) // 2% of 5,550,000
  })
})
