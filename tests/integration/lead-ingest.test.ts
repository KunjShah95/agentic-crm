import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  webhookEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  contact: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  pipelineStage: { findFirst: vi.fn() },
  deal: { create: vi.fn(), count: vi.fn() },
  activity: { create: vi.fn() },
  workspaceMember: { findMany: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))

import { processLead } from "@/modules/leadIngest/worker"

beforeEach(() => {
  Object.values(db).forEach((m) => Object.values(m).forEach((fn) => (fn as any).mockReset?.()))
  db.webhookEvent.findUnique.mockResolvedValue(null)
  db.webhookEvent.create.mockResolvedValue({ id: "we1" })
  db.webhookEvent.update.mockResolvedValue({})
  db.contact.findFirst.mockResolvedValue(null)
  db.contact.create.mockResolvedValue({ id: "c1", firstName: "Meera", lastName: "Shah", phone: "+919800000000", optedOut: false })
  db.pipelineStage.findFirst.mockResolvedValue({ id: "stage1" })
  db.deal.create.mockResolvedValue({ id: "d1" })
  db.deal.count.mockResolvedValue(0)
  db.activity.create.mockResolvedValue({ id: "a1" })
  db.workspaceMember.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }])
})

describe("lead ingest pipeline", () => {
  it("webhook payload → dedupe + score + route + Contact/Deal/Activity + auto-ack + audit", async () => {
    const r = await processLead({
      workspaceId: "w1",
      source: "ninety_nine_acres",
      payload: { lead_id: "99-9", name: "Meera Shah", phone: "+919800000000", config: "3BHK", intent: "HOT", locality: "Bopal", budget: "80-90 Lakh" },
    })
    expect(r.deduped).toBe(false)
    expect(r.score).toBeGreaterThan(50)
    // marks event processed (processedAt = DONE marker)
    expect(db.webhookEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ processedAt: expect.any(Date) }) }))
    // auto-ack + inbound lead + consent audit all land on the timeline
    const channels = db.activity.create.mock.calls.map((c) => c[0].data.channel)
    expect(channels).toContain("LEAD")
    expect(channels).toContain("WHATSAPP")
    expect(channels).toContain("AUDIT")
  })

  it("second identical webhook is deduped", async () => {
    db.webhookEvent.findUnique.mockResolvedValue({ id: "we1", processedAt: new Date() })
    const r = await processLead({ workspaceId: "w1", source: "ninety_nine_acres", payload: { lead_id: "99-9", name: "Meera Shah", phone: "+919800000000" } })
    expect(r.deduped).toBe(true)
    expect(db.contact.create).not.toHaveBeenCalled()
  })
})
