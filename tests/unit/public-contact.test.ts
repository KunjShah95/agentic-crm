import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({
  workspace: { findFirst: vi.fn() },
  organization: { findFirst: vi.fn(), create: vi.fn() },
  contact: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  activity: { create: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/permissions", () => ({
  requireWorkspaceMember: vi.fn(),
  canManageData: vi.fn(),
}))
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "1.2.3.4" })),
}))
const sendEmail = vi.hoisted(() => vi.fn().mockResolvedValue({ id: "e1", mock: true, to: "t" }))
vi.mock("@/modules/email/adapter", () => ({ sendEmail }))

import { submitPublicContactAction } from "@/lib/actions/contacts"
import { _resetWebContactRateLimitForTests } from "@/modules/web-contact/rate-limit"

const WS = { id: "w1" }
const CONTACT = { id: "c1", phone: null, organizationId: null, leadSource: null }

beforeEach(() => {
  for (const model of Object.values(db)) {
    for (const fn of Object.values(model)) (fn as ReturnType<typeof vi.fn>).mockReset()
  }
  _resetWebContactRateLimitForTests()
  sendEmail.mockClear()
  db.workspace.findFirst.mockResolvedValue(WS)
  db.organization.findFirst.mockResolvedValue(null)
  db.organization.create.mockResolvedValue({ id: "o1" })
  db.contact.findFirst.mockResolvedValue(null)
  db.contact.create.mockResolvedValue(CONTACT)
  db.contact.update.mockResolvedValue(CONTACT)
  db.activity.create.mockResolvedValue({ id: "a1" })
})

const valid = {
  name: "Hemal Shah",
  email: "HEMAL@shilp.co.in",
  company: "Shilp Infra",
  phone: "+91 98xxx xxxxx",
  message: "We run 3 sites on SG Highway and need HOLD to CLP without Excel.",
}

describe("submitPublicContactAction", () => {
  it("creates a contact + inbound activity with channel WEB / direction IN", async () => {
    const res = await submitPublicContactAction(valid)

    expect(res.error).toBeUndefined()
    expect(db.contact.create).toHaveBeenCalledOnce()
    const contactData = db.contact.create.mock.calls[0][0].data
    expect(contactData).toMatchObject({
      workspaceId: "w1",
      firstName: "Hemal",
      lastName: "Shah",
      email: "hemal@shilp.co.in", // normalized to lowercase
      leadSource: "WEBSITE_CONTACT_FORM",
      createdBy: "system",
    })

    const activityData = db.activity.create.mock.calls[0][0].data
    expect(activityData).toMatchObject({
      workspaceId: "w1",
      contactId: "c1",
      type: "NOTE",
      source: "WEBSITE_CONTACT_FORM",
      channel: "WEB",
      direction: "IN",
    })
    expect(activityData.body).toContain("We run 3 sites on SG Highway")

    expect(sendEmail).toHaveBeenCalledOnce()
    expect(sendEmail.mock.calls[0][0].subject).toContain("New website enquiry")
    expect(sendEmail.mock.calls[0][0].to).toBeTruthy()
  })

  it("creates the organization when a new company name is given", async () => {
    db.organization.findFirst.mockResolvedValue(null)
    db.organization.create.mockResolvedValue({ id: "o1" })

    await submitPublicContactAction(valid)

    expect(db.organization.create).toHaveBeenCalledOnce()
    expect(db.contact.create.mock.calls[0][0].data.organizationId).toBe("o1")
  })

  it("links the existing organization and updates the existing contact on repeat submission", async () => {
    db.organization.findFirst.mockResolvedValue({ id: "o1" })
    db.contact.findFirst.mockResolvedValue({ id: "c1", phone: "+919812345678", organizationId: null, leadSource: "WEBSITE_CONTACT_FORM" })

    const res = await submitPublicContactAction(valid)

    expect(res.error).toBeUndefined()
    expect(db.contact.create).not.toHaveBeenCalled()
    expect(db.contact.update).toHaveBeenCalledOnce()
    const updateData = db.contact.update.mock.calls[0][0].data
    expect(updateData).toMatchObject({ organizationId: "o1", consentAt: expect.any(Date) })
  })

  it("silently ignores honeypot submissions without writing to the DB", async () => {
    const res = await submitPublicContactAction({ ...valid, website: "http://spam.example" })

    expect(res.error).toBeUndefined()
    expect(db.contact.create).not.toHaveBeenCalled()
    expect(db.activity.create).not.toHaveBeenCalled()
  })

  it("rejects invalid email without touching the DB", async () => {
    const res = await submitPublicContactAction({ ...valid, email: "not-an-email" })

    expect(res.error?.code).toBe("VALIDATION")
    expect(db.contact.create).not.toHaveBeenCalled()
    expect(db.activity.create).not.toHaveBeenCalled()
  })

  it("rejects too-short messages", async () => {
    const res = await submitPublicContactAction({ ...valid, message: "hi" })

    expect(res.error?.code).toBe("VALIDATION")
    expect(db.contact.create).not.toHaveBeenCalled()
  })

  it("still succeeds when the team notification email fails", async () => {
    sendEmail.mockRejectedValueOnce(new Error("resend down"))

    const res = await submitPublicContactAction(valid)

    expect(res.error).toBeUndefined()
    expect(db.activity.create).toHaveBeenCalledOnce()
  })

  it("rate-limits bursts from the same IP after the 5th submission", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await submitPublicContactAction(valid)
      expect(r.error).toBeUndefined()
    }
    const blocked = await submitPublicContactAction(valid)
    expect(blocked.error?.code).toBe("RATE_LIMITED")
    expect(db.contact.create).toHaveBeenCalledTimes(5)
  })

  it("errors clearly when no workspace exists to receive submissions", async () => {
    db.workspace.findFirst.mockResolvedValue(null)
    const res = await submitPublicContactAction(valid)

    expect(res.error?.code).toBe("SERVER_ERROR")
    expect(db.contact.create).not.toHaveBeenCalled()
  })
})
