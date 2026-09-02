import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  contact: { findFirst: vi.fn() },
  activity: { create: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "agent-1" } }) }))
vi.mock("@/lib/permissions", () => ({ requireWorkspaceMember: vi.fn().mockResolvedValue({ role: "MEMBER" }) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
const adapter = vi.hoisted(() => ({ sendWhatsApp: vi.fn().mockResolvedValue({ id: "wamid.OUT", mock: true, to: "+919812345678" }) }))
vi.mock("@/modules/whatsapp/adapter", () => adapter)

import { sendWhatsAppMessage, recordInboundWhatsApp } from "@/modules/whatsapp/actions"

beforeEach(() => {
  db.contact.findFirst.mockReset()
  db.activity.create.mockReset().mockImplementation(async (arg: any) => ({ id: "act", ...arg.data }))
  adapter.sendWhatsApp.mockClear()
})

describe("whatsapp 2-way roundtrip", () => {
  it("agent sends OUT then lead replies IN — both land on the same contact timeline", async () => {
    const contact = { id: "c1", workspaceId: "w1", phone: "+919812345678", optedOut: false }

    // 1. Agent sends outbound
    db.contact.findFirst.mockResolvedValueOnce(contact)
    const out = await sendWhatsAppMessage({ workspaceId: "w1", contactId: "c1", body: "Hi Ravi, availability attached." })
    expect(out.messageId).toBe("wamid.OUT")
    expect(adapter.sendWhatsApp).toHaveBeenCalledOnce()

    // 2. Lead replies inbound (Meta webhook → recordInboundWhatsApp)
    db.contact.findFirst.mockResolvedValueOnce(contact)
    const inbound = await recordInboundWhatsApp({ workspaceId: "w1", from: "919812345678", body: "Yes, book a visit" })
    expect(inbound?.contactId).toBe("c1")

    // Both activities scoped to same workspace + contact, opposite directions
    const calls = db.activity.create.mock.calls.map((c) => c[0].data)
    expect(calls).toHaveLength(2)
    expect(calls.every((d) => d.workspaceId === "w1" && d.contactId === "c1" && d.channel === "WHATSAPP")).toBe(true)
    expect(calls.map((d) => d.direction)).toEqual(["OUT", "IN"])
  })

  it("inbound from an unknown number is ignored (no timeline write)", async () => {
    db.contact.findFirst.mockResolvedValueOnce(null)
    const r = await recordInboundWhatsApp({ workspaceId: "w1", from: "10000000000", body: "spam" })
    expect(r).toBeNull()
    expect(db.activity.create).not.toHaveBeenCalled()
  })
})
