import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Mock } from "vitest"

const db = vi.hoisted(() => ({
  workspace: { findUnique: vi.fn() },
  contact: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  webhookEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  pipelineStage: { findFirst: vi.fn() },
  deal: { create: vi.fn(), count: vi.fn() },
  activity: { create: vi.fn() },
  workspaceMember: { findMany: vi.fn() },
  leadSourceConfig: { findUnique: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))

const EXPIRED_TRIAL_WS = {
  id: "w1",
  plan: "free",
  createdAt: new Date(Date.UTC(2025, 0, 1)), // well past the 14-day trial
  subscription: null,
  settingsJson: {},
}

beforeEach(() => {
  Object.values(db).forEach((model) =>
    Object.values(model).forEach((fn) => (fn as Mock).mockReset()),
  )
  db.workspace.findUnique.mockResolvedValue(EXPIRED_TRIAL_WS)
  db.contact.count.mockResolvedValue(500) // at the Free ceiling
  db.webhookEvent.findUnique.mockResolvedValue(null)
  db.webhookEvent.create.mockResolvedValue({ id: "we1" })
  db.contact.findFirst.mockResolvedValue(null)
  db.leadSourceConfig.findUnique.mockResolvedValue(null)
  db.workspaceMember.findMany.mockResolvedValue([{ userId: "u1", role: "MEMBER" }])
  db.deal.count.mockResolvedValue(0)
})

describe("contacts quota after the trial lapses", () => {
  it("requireQuota rejects once the workspace already holds 500 contacts", async () => {
    const { requireQuota } = await import("@/modules/billing/quota")
    await expect(requireQuota("w1", "contacts")).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" })
  })

  it("inbound lead ingest does not create a contact past the Free cap", async () => {
    const { processLead } = await import("@/modules/leadIngest/worker")
    await expect(
      processLead({
        workspaceId: "w1",
        source: "meta",
        payload: { lead_id: "m-1", name: "Ravi Patel", phone: "+919812345678" },
      }),
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" })
    expect(db.contact.create).not.toHaveBeenCalled()
    expect(db.deal.create).not.toHaveBeenCalled()
  })

  it("still allows creation while the trial's Team plan applies", async () => {
    db.workspace.findUnique.mockResolvedValue({
      ...EXPIRED_TRIAL_WS,
      createdAt: new Date(), // fresh workspace → pro trial limits
    })
    db.contact.count.mockResolvedValue(500)
    const { requireQuota } = await import("@/modules/billing/quota")
    await expect(requireQuota("w1", "contacts")).resolves.toBeUndefined()
  })
})
