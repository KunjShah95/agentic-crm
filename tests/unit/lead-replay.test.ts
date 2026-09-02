import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  webhookEvent: { findMany: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))
const worker = vi.hoisted(() => ({ processLead: vi.fn() }))
vi.mock("@/modules/leadIngest/worker", () => worker)

import { replayPending } from "@/worker/replay"

beforeEach(() => {
  db.webhookEvent.findMany.mockReset()
  worker.processLead.mockReset().mockResolvedValue({ deduped: false, contactId: "c1" })
})

describe("replayPending", () => {
  it("reprocesses unprocessed events and reports counts", async () => {
    db.webhookEvent.findMany.mockResolvedValue([
      { id: "e1", workspaceId: "w1", source: "META", payload: { lead_id: "1" } },
      { id: "e2", workspaceId: "w1", source: "PABBLY", payload: { lead_id: "2" } },
    ])
    const r = await replayPending()
    expect(worker.processLead).toHaveBeenCalledTimes(2)
    expect(worker.processLead).toHaveBeenCalledWith({ workspaceId: "w1", source: "META", payload: { lead_id: "1" } })
    expect(r).toMatchObject({ total: 2, processed: 2, failed: 0 })
  })

  it("filters by workspaceId when provided", async () => {
    db.webhookEvent.findMany.mockResolvedValue([])
    await replayPending({ workspaceId: "w9", limit: 10 })
    expect(db.webhookEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { processedAt: null, workspaceId: "w9" }, take: 10 })
    )
  })

  it("counts failures without throwing (one bad event does not block others)", async () => {
    db.webhookEvent.findMany.mockResolvedValue([
      { id: "e1", workspaceId: "w1", source: "META", payload: {} },
      { id: "e2", workspaceId: "w1", source: "META", payload: {} },
    ])
    worker.processLead.mockRejectedValueOnce(new Error("boom"))
    const r = await replayPending()
    expect(r).toMatchObject({ total: 2, processed: 1, failed: 1 })
  })
})
