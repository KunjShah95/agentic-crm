import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Mock } from "vitest"

const db = vi.hoisted(() => ({
  webhookEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  contact: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  pipelineStage: { findFirst: vi.fn() },
  deal: { create: vi.fn(), count: vi.fn() },
  activity: { create: vi.fn() },
  workspaceMember: { findMany: vi.fn() },
  workspace: { findUnique: vi.fn() },
  leadSourceConfig: { findUnique: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))

import { processLead } from "@/modules/leadIngest/worker"

const LEAD = {
  lead_id: "99-9",
  name: "Meera Shah",
  phone: "+919800000000",
  config: "3BHK",
  intent: "HOT",
  locality: "Bopal",
  budget: "80-90 Lakh",
}

function channels() {
  return db.activity.create.mock.calls.map((c) => c[0].data.channel)
}

/** Outbound WhatsApp rows only. Scheduled follow-up tasks also carry
 *  channel WHATSAPP ("Share cost sheet on WhatsApp") but are reminders for
 *  staff with no direction, not messages sent to the lead. */
function outboundWhatsApp() {
  return db.activity.create.mock.calls.filter(
    (c) => c[0].data.channel === "WHATSAPP" && c[0].data.direction === "OUT"
  )
}

function autoAckOff() {
  db.workspace.findUnique.mockResolvedValue({ settingsJson: {} })
}

function autoAckOn() {
  db.workspace.findUnique.mockResolvedValue({
    settingsJson: { leadIngest: { autoAck: true } },
  })
}

beforeEach(() => {
  Object.values(db).forEach((model) =>
    Object.values(model).forEach((fn) => (fn as Mock).mockReset()),
  )
  db.webhookEvent.findUnique.mockResolvedValue(null)
  db.leadSourceConfig.findUnique.mockResolvedValue(null)
  db.webhookEvent.create.mockResolvedValue({ id: "we1" })
  db.webhookEvent.update.mockResolvedValue({})
  db.contact.findFirst.mockResolvedValue(null)
  db.contact.create.mockResolvedValue({ id: "c1", firstName: "Meera", lastName: "Shah", phone: "+919800000000", optedOut: false })
  db.pipelineStage.findFirst.mockResolvedValue({ id: "stage1" })
  db.deal.create.mockResolvedValue({ id: "d1" })
  db.deal.count.mockResolvedValue(0)
  db.activity.create.mockResolvedValue({ id: "a1" })
  db.workspaceMember.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }])
  autoAckOff()
})

describe("lead ingest pipeline", () => {
  it("webhook payload → dedupe + score + route + Contact/Deal/Activity + audit", async () => {
    const r = await processLead({
      workspaceId: "w1",
      source: "ninety_nine_acres",
      payload: LEAD,
      trusted: true,
    })
    expect(r.deduped).toBe(false)
    expect(r.score).toBeGreaterThan(50)
    // marks event processed (processedAt = DONE marker)
    expect(db.webhookEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ processedAt: expect.any(Date) }) }))
    const seen = channels()
    expect(seen).toContain("LEAD")
    expect(seen).toContain("AUDIT")
  })

  it("second identical webhook is deduped", async () => {
    db.webhookEvent.findUnique.mockResolvedValue({ id: "we1", processedAt: new Date() })
    const r = await processLead({ workspaceId: "w1", source: "ninety_nine_acres", payload: LEAD, trusted: true })
    expect(r.deduped).toBe(true)
    expect(db.contact.create).not.toHaveBeenCalled()
  })
})

/**
 * The auto-ack is the only irreversible thing this pipeline does: it sends a
 * WhatsApp message to a phone number taken from the payload. These tests pin
 * the two gates, because the failure they protect against is a stranger
 * getting a customer's business number to message arbitrary people.
 */
describe("WhatsApp auto-ack gating", () => {
  it("does not send when the workspace has not opted in, even on a trusted ingress", async () => {
    autoAckOff()
    const r = await processLead({
      workspaceId: "w1",
      source: "ninety_nine_acres",
      payload: LEAD,
      trusted: true,
    })
    expect(r.acked).toBe(false)
    expect(outboundWhatsApp()).toHaveLength(0)
  })

  it("sends when the workspace opted in and the ingress was trusted", async () => {
    autoAckOn()
    await processLead({
      workspaceId: "w1",
      source: "ninety_nine_acres",
      payload: LEAD,
      trusted: true,
    })
    // The outbound attempt is recorded on the timeline. `acked` stays false
    // here only because WhatsApp is unconfigured in tests, so the adapter
    // returns a mock — it reports real delivery, not intent.
    expect(channels()).toContain("WHATSAPP")
    const out = db.activity.create.mock.calls.find(
      (c) => c[0].data.channel === "WHATSAPP" && c[0].data.direction === "OUT"
    )
    expect(out?.[0].data.body).toContain("Meera")
  })

  it("does not send on an untrusted ingress even when opted in", async () => {
    // The replay route passes no `trusted`: historical events were captured
    // before consent existed, so replaying them must not produce messages.
    autoAckOn()
    const r = await processLead({
      workspaceId: "w1",
      source: "ninety_nine_acres",
      payload: LEAD,
    })
    expect(r.acked).toBe(false)
    expect(outboundWhatsApp()).toHaveLength(0)
  })

  it("still captures the lead when the ack is suppressed", async () => {
    // Suppressing outbound must never cost us the lead itself.
    autoAckOff()
    const r = await processLead({
      workspaceId: "w1",
      source: "ninety_nine_acres",
      payload: LEAD,
      trusted: true,
    })
    expect(r.contactId).toBe("c1")
    expect(db.contact.create).toHaveBeenCalled()
    expect(db.webhookEvent.update).toHaveBeenCalled()
  })

  it("records in the audit trail that nothing was sent", async () => {
    autoAckOff()
    await processLead({ workspaceId: "w1", source: "ninety_nine_acres", payload: LEAD, trusted: true })
    const audit = db.activity.create.mock.calls.find((c) => c[0].data.channel === "AUDIT")
    expect(audit?.[0].data.body).toContain("not sent")
    // It must not claim consent that was never obtained.
    expect(audit?.[0].data.body).not.toContain("Consent recorded")
  })
})