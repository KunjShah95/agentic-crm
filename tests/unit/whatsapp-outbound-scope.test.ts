import { describe, it, expect, beforeEach, vi } from "vitest"

/**
 * Outbound broker scoping for `sendWhatsAppMessage`.
 *
 * Every inbox *read* is broker-scoped, and that is not sufficient: a Next.js
 * server action is a public HTTP endpoint on the app, reachable without going
 * through the UI that scopes it. Before this gate the action verified workspace
 * membership and then passed the caller-supplied `contactId` straight to the
 * outbox, so any BROKER could send a WhatsApp message to any contact in the
 * tenant.
 *
 * That is worse than a read leak in three specific ways, which is why it gets a
 * test rather than a code comment:
 *
 *  1. It is an *outbound* message on the company's own business number, to a real
 *     customer's phone, with no human in the loop and no UI affordance.
 *  2. `docs/architecture/production-readiness.md` already records unsolicited
 *     outbound as a WhatsApp-policy ban risk on *that customer's* account — so
 *     one broker can cost the tenant its business number.
 *  3. It cannot be undone. Reading another broker's rows leaves a log; the message
 *     is delivered.
 *
 * Note the assertion is on the *refusal*, not on a provider mock: the guarantee
 * worth locking down is that the action never reaches the outbox for a contact
 * the caller cannot see.
 */

const authMock = vi.fn()
const membershipMock = vi.fn()
const sendMock = vi.fn()
const scopeMock = vi.fn()

const db = {
  contact: { findFirst: vi.fn() },
}

vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/permissions", () => ({
  requireWorkspaceMember: membershipMock,
  resolveViewerScope: scopeMock,
  brokerContactScope: (role: string, brokerId?: string | null) =>
    role === "BROKER" ? { deals: { some: { brokerId: brokerId ?? "__no_broker__" } } } : {},
}))
vi.mock("@/modules/comms/outbox", () => ({
  sendOutboundWhatsAppMessage: sendMock,
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: "u_broker" } })
  membershipMock.mockResolvedValue({
    role: "BROKER",
    workspaceId: "ws1",
    workspace: { slug: "acme", name: "Acme" },
  })
  sendMock.mockResolvedValue({ ok: true, activityId: "a1", messageId: "m1", mock: false })
})

async function action() {
  return (await import("@/modules/whatsapp/actions")).sendWhatsAppMessage
}

describe("sendWhatsAppMessage broker scoping", () => {
  it("refuses a contact outside the broker's book and never reaches the outbox", async () => {
    scopeMock.mockResolvedValue({ workspaceId: "ws1", role: "BROKER", brokerId: "cp-1" })
    // The scoped lookup finds nothing — the shape a foreign contact has from
    // inside this workspace.
    db.contact.findFirst.mockResolvedValue(null)

    const send = await action()
    const res = await send({ workspaceId: "ws1", contactId: "c_foreign", body: "hi" })

    expect(res).toMatchObject({ ok: false, code: "CONTACT_NOT_FOUND" })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("reports the refusal as not-found rather than forbidden", async () => {
    // A distinct permission error would confirm the contact exists, turning the
    // action into an oracle for enumerating another broker's book. The refusal
    // has to be indistinguishable from a wrong id.
    scopeMock.mockResolvedValue({ workspaceId: "ws1", role: "BROKER", brokerId: "cp-1" })
    db.contact.findFirst.mockResolvedValue(null)

    const send = await action()
    const res = await send({ workspaceId: "ws1", contactId: "c_foreign", body: "hi" })

    expect(res).toMatchObject({ code: "CONTACT_NOT_FOUND" })
    expect(JSON.stringify(res)).not.toMatch(/broker|forbidden|permission|not your/i)
  })

  it("scopes the contact lookup through the broker's deals", async () => {
    scopeMock.mockResolvedValue({ workspaceId: "ws1", role: "BROKER", brokerId: "cp-1" })
    db.contact.findFirst.mockResolvedValue({ id: "c1" })

    const send = await action()
    await send({ workspaceId: "ws1", contactId: "c1", body: "hi" })

    expect(db.contact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "c1",
          workspaceId: "ws1",
          deals: { some: { brokerId: "cp-1" } },
        }),
      }),
    )
  })

  it("a BROKER with no linked broker record matches nothing", async () => {
    scopeMock.mockResolvedValue({ workspaceId: "ws1", role: "BROKER", brokerId: null })
    db.contact.findFirst.mockResolvedValue(null)

    const send = await action()
    const res = await send({ workspaceId: "ws1", contactId: "c1", body: "hi" })

    expect(db.contact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deals: { some: { brokerId: "__no_broker__" } } }),
      }),
    )
    expect(res).toMatchObject({ ok: false })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("lets a broker message their own contact", async () => {
    scopeMock.mockResolvedValue({ workspaceId: "ws1", role: "BROKER", brokerId: "cp-1" })
    db.contact.findFirst.mockResolvedValue({ id: "c1" })

    const send = await action()
    const res = await send({ workspaceId: "ws1", contactId: "c1", body: "hi" })

    expect(res).toMatchObject({ ok: true })
    expect(sendMock).toHaveBeenCalledOnce()
  })

  it("adds no broker predicate for a non-BROKER role", async () => {
    for (const role of ["OWNER", "ADMIN", "MEMBER", "SALES", "VIEWER"] as const) {
      vi.clearAllMocks()
      authMock.mockResolvedValue({ user: { id: "u_owner" } })
      membershipMock.mockResolvedValue({
        role,
        workspaceId: "ws1",
        workspace: { slug: "acme", name: "Acme" },
      })
      scopeMock.mockResolvedValue({ workspaceId: "ws1", role, brokerId: "cp-1" })
      db.contact.findFirst.mockResolvedValue({ id: "c1" })
      sendMock.mockResolvedValue({ ok: true, activityId: "a1", messageId: "m1", mock: false })

      const send = await action()
      const res = await send({ workspaceId: "ws1", contactId: "c1", body: "hi" })

      // An admin passing a stray brokerId must still reach the contact: an
      // unconditional predicate here would silently hide records from staff.
      const where = db.contact.findFirst.mock.calls[0][0].where
      expect(where.deals, `role ${role}`).toBeUndefined()
      expect(res).toMatchObject({ ok: true })
    }
  })

  it("refuses when there is no session, without touching the contact", async () => {
    authMock.mockResolvedValue(null)

    const send = await action()
    const res = await send({ workspaceId: "ws1", contactId: "c1", body: "hi" })

    expect(res).toMatchObject({ ok: false })
    expect(db.contact.findFirst).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("refuses when the caller is not a member of the workspace", async () => {
    membershipMock.mockRejectedValue(new Error("not a member"))

    const send = await action()
    const res = await send({ workspaceId: "ws_victim", contactId: "c1", body: "hi" })

    expect(res).toMatchObject({ ok: false })
    expect(sendMock).not.toHaveBeenCalled()
  })
})