import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  contact: { findFirst: vi.fn() },
  activity: { create: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }) }))
vi.mock("@/lib/permissions", () => ({ requireWorkspaceMember: vi.fn().mockResolvedValue({ role: "MEMBER" }) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
const sms = vi.hoisted(() => ({ sendSms: vi.fn().mockResolvedValue({ id: "SM1", mock: true, to: "+91" }) }))
const email = vi.hoisted(() => ({ sendEmail: vi.fn().mockResolvedValue({ id: "E1", mock: true, to: "x@y.z" }) }))
vi.mock("@/modules/sms/adapter", () => sms)
vi.mock("@/modules/email/adapter", () => email)

import { sendSmsMessage, sendEmailMessage, logCall } from "@/modules/comms/actions"

beforeEach(() => {
  db.contact.findFirst.mockReset()
  db.activity.create.mockReset().mockResolvedValue({ id: "a1" })
  sms.sendSms.mockClear()
  email.sendEmail.mockClear()
})

describe("comms actions", () => {
  it("sendSmsMessage logs an OUT SMS activity", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "c1", phone: "+919812345678", optedOut: false })
    const r = await sendSmsMessage({ workspaceId: "w1", contactId: "c1", body: "hi" })
    expect(sms.sendSms).toHaveBeenCalledOnce()
    expect(db.activity.create.mock.calls[0][0].data).toMatchObject({ channel: "SMS", direction: "OUT" })
    expect(r.messageId).toBe("SM1")
  })

  it("sendSmsMessage refuses opted-out contacts", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "c1", phone: "+91", optedOut: true })
    await expect(sendSmsMessage({ workspaceId: "w1", contactId: "c1", body: "hi" })).rejects.toThrow(/opted out/i)
    expect(sms.sendSms).not.toHaveBeenCalled()
  })

  it("sendEmailMessage logs an OUT EMAIL activity", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "c1", email: "ravi@example.com", optedOut: false })
    const r = await sendEmailMessage({ workspaceId: "w1", contactId: "c1", subject: "Hi", body: "Welcome" })
    expect(email.sendEmail).toHaveBeenCalledOnce()
    expect(db.activity.create.mock.calls[0][0].data).toMatchObject({ channel: "EMAIL", direction: "OUT" })
    expect(r.messageId).toBe("E1")
  })

  it("logCall records a CALL activity with duration", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "c1", phone: "+91" })
    await logCall({ workspaceId: "w1", contactId: "c1", direction: "OUT", durationSec: 120, notes: "Discussed pricing" })
    const data = db.activity.create.mock.calls[0][0].data
    expect(data).toMatchObject({ channel: "CALL", direction: "OUT", type: "CALL" })
    expect(data.body).toContain("120")
  })
})
