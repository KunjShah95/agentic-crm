import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  webhookEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  contact: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  pipelineStage: { findFirst: vi.fn() },
  deal: { create: vi.fn(), count: vi.fn() },
  activity: { create: vi.fn() },
  workspaceMember: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))

import { processLead } from "@/modules/leadIngest/worker"

beforeEach(() => {
  Object.values(db).forEach((m) => Object.values(m).forEach((fn) => (fn as any).mockReset?.()))
  db.webhookEvent.findUnique.mockResolvedValue(null)
  db.webhookEvent.create.mockResolvedValue({ id: "we1" })
  db.webhookEvent.update.mockResolvedValue({})
  db.contact.findFirst.mockResolvedValue(null)
  db.contact.create.mockResolvedValue({ id: "c1", firstName: "Ravi", lastName: "Patel" })
  db.contact.update.mockResolvedValue({ id: "c1" })
  db.pipelineStage.findFirst.mockResolvedValue({ id: "stage1" })
  db.deal.create.mockResolvedValue({ id: "d1", title: "Ravi Patel" })
  db.deal.count.mockResolvedValue(0)
  db.activity.create.mockResolvedValue({ id: "a1" })
  db.workspaceMember.findMany.mockResolvedValue([{ userId: "u1", role: "MEMBER" }])
  db.auditLog.create.mockResolvedValue({ id: "al1" })
})

describe("processLead", () => {
  it("creates contact + deal + activity + score for a new lead", async () => {
    const r = await processLead({
      workspaceId: "w1",
      source: "meta",
      payload: { lead_id: "m-1", name: "Ravi Patel", phone: "+919812345678", config: "3BHK", intent: "HOT" },
    })
    expect(r.deduped).toBe(false)
    expect(db.contact.create).toHaveBeenCalledOnce()
    expect(db.deal.create).toHaveBeenCalledOnce()
    expect(db.activity.create).toHaveBeenCalled()
    expect(r.score).toBeGreaterThan(0)
    // contact created with leadScore + leadSource
    const contactArg = db.contact.create.mock.calls[0][0].data
    expect(contactArg.leadSource).toBe("META")
    expect(contactArg.leadScore).toBe(r.score)
  })

  it("dedupes an already-processed event", async () => {
    db.webhookEvent.findUnique.mockResolvedValue({ id: "we1", processedAt: new Date() })
    const r = await processLead({ workspaceId: "w1", source: "meta", payload: { lead_id: "m-1", name: "X", phone: "1" } })
    expect(r.deduped).toBe(true)
    expect(db.contact.create).not.toHaveBeenCalled()
  })

  it("reuses existing contact by phone", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "existing", firstName: "Ravi", lastName: "Patel" })
    const r = await processLead({ workspaceId: "w1", source: "meta", payload: { lead_id: "m-2", name: "Ravi Patel", phone: "+919812345678" } })
    expect(db.contact.create).not.toHaveBeenCalled()
    expect(r.contactId).toBe("existing")
  })
})
