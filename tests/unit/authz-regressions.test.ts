import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Regression tests for authorization defects found in review.
 *
 * Each of these encodes a bug that was live in the codebase. They are written
 * against the *gate*, not against the happy path: the point is to fail if
 * someone removes the check, not to prove the feature works. Several of these
 * had no coverage at all, which is why an unauthenticated caller could mint
 * buyer-portal tokens for other tenants.
 *
 * The shared shape is a mocked `auth` returning a session, a mocked
 * `requireWorkspaceMember`, and a mocked `db`. Tests that assert a rejection
 * must not be satisfied by a thrown "Unauthorized" from a missing session —
 * the session is present, so a throw can only come from the check under test.
 */

const authMock = vi.fn()
const membershipMock = vi.fn()

vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/lib/permissions", () => ({
  requireWorkspaceMember: membershipMock,
  canInvite: () => true,
  canManageData: () => true,
  hasMinRole: () => true,
}))

/**
 * Records every write so we can assert a mutation never happened.
 *
 * Deliberately untyped delegates. These mocks exist to observe the *arguments*
 * the code under test passes and to control what it reads back; typing them
 * precisely buys nothing here and pushes the assertions toward casts — the same
 * escape hatch that let the original defects through the compiler unnoticed.
 * What each assertion needs is instead narrowed at the point of use, to exactly
 * the one field it is about, so a wrong argument shape fails loudly.
 */
type ContactRow = { id: string }
type UnitRow = { id: string }

const makeDb = () => ({
  buyerPortalAccess: {
    create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: "bpa_1", ...args.data })),
  },
  contact: { findFirst: vi.fn(async (_args: unknown): Promise<ContactRow | null> => null) },
  unit: {
    findFirst: vi.fn(async (_args: unknown): Promise<UnitRow | null> => null),
    update: vi.fn(async (_args: { data: Record<string, unknown> }) => ({})),
  },
  deal: {
    findFirst: vi.fn(async (_args: unknown) => ({ id: "d1", bookingStage: "INQUIRY" })),
    update: vi.fn(async (_args: { data: Record<string, unknown> }) => ({})),
  },
  activity: { create: vi.fn(async (_args: unknown) => ({})) },
  workspaceMember: {
    findUnique: vi.fn(async (_args: unknown): Promise<Record<string, unknown> | null> => null),
    update: vi.fn(async (_args: unknown) => ({})),
  },
  workspace: {
    findFirst: vi.fn(async (_args: unknown) => ({ id: "ws1" })),
    findUnique: vi.fn(async (_args: unknown) => ({ id: "ws1" })),
  },
  association: { create: vi.fn(async (_args: unknown) => ({ id: "as1", name: "A" })) },
  associationMember: {
    create: vi.fn(async (_args: unknown) => ({})),
    findUnique: vi.fn(async (_args: unknown): Promise<Record<string, unknown> | null> => null),
  },
})

type MockDb = ReturnType<typeof makeDb>

/**
 * Populated in beforeEach; the Proxy defers the lookup so `vi.resetModules()`
 * re-imports the action modules against a fresh mock rather than one captured
 * at hoist time.
 */
vi.mock("@/lib/db", () => {
  const holder = globalThis as Record<string, unknown>
  return {
    db: new Proxy<Record<string, unknown>>(
      {},
      {
        get: (_target, key: string) => (holder.__db as Record<string, unknown> | undefined)?.[key],
      },
    ),
  }
})
// holdUnit revalidates a cache path after a successful write; that import is not
// resolvable in the test environment and is irrelevant to the authorization
// behaviour under test.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

let db!: MockDb

beforeEach(() => {
  vi.resetModules()
  db = makeDb()
  ;(globalThis as Record<string, unknown>).__db = db
  authMock.mockReset().mockResolvedValue({ user: { id: "u_owner" } })
  membershipMock.mockReset().mockResolvedValue({ role: "ADMIN", workspaceId: "ws1" })
})

describe("createBuyerAccess", () => {
  it("refuses when there is no session", async () => {
    authMock.mockResolvedValue(null)
    const m = await import("@/modules/buyerPortal/actions")
    await expect(m.createBuyerAccess("ws1", "c1")).rejects.toThrow()
    expect(db.buyerPortalAccess.create).not.toHaveBeenCalled()
  })

  it("refuses when the caller is not a member of the target workspace", async () => {
    membershipMock.mockRejectedValue(new Error("not a member"))
    const m = await import("@/modules/buyerPortal/actions")
    await expect(m.createBuyerAccess("ws_victim", "c1")).rejects.toThrow()
    // The critical assertion: a grant must never be minted for a workspace the
    // caller could not prove membership of.
    expect(db.buyerPortalAccess.create).not.toHaveBeenCalled()
  })

  it("refuses when the contact belongs to another workspace", async () => {
    // The lookup is scoped { id, workspaceId }; returning null is what a
    // foreign contact looks like from inside this workspace.
    db.contact.findFirst.mockResolvedValue(null)
    const m = await import("@/modules/buyerPortal/actions")
    await expect(m.createBuyerAccess("ws1", "c_foreign")).rejects.toThrow()
    expect(db.buyerPortalAccess.create).not.toHaveBeenCalled()
  })

  it("mints a grant for a contact proven to be in the workspace", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "c1" })
    const m = await import("@/modules/buyerPortal/actions")
    await m.createBuyerAccess("ws1", "c1", 30)
    expect(db.buyerPortalAccess.create).toHaveBeenCalledOnce()
    expect(db.contact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "c1", workspaceId: "ws1" }) }),
    )
  })

  it("caps daysValid so a grant cannot be made effectively permanent", async () => {
    db.contact.findFirst.mockResolvedValue({ id: "c1" })
    const m = await import("@/modules/buyerPortal/actions")
    await m.createBuyerAccess("ws1", "c1", 100_000)
    const { data } = db.buyerPortalAccess.create.mock.calls[0][0] as {
      data: { expiresAt: Date }
    }
    const days = (data.expiresAt.getTime() - Date.now()) / 86_400_000
    expect(days).toBeLessThanOrEqual(366)
    expect(days).toBeGreaterThan(0)
  })
})

describe("holdUnit", () => {
  it("refuses to hold a unit that is not in the caller's workspace", async () => {
    const m = await import("@/modules/booking/actions")
    await expect(
      m.holdUnit({ workspaceId: "ws1", dealId: "d1", unitId: "u_foreign" }),
    ).rejects.toThrow()
    // Cross-tenant inventory sabotage: the unit update must not happen.
    expect(db.unit.update).not.toHaveBeenCalled()
  })

  it("never writes a foreign unitId onto the deal", async () => {
    db.unit.findFirst.mockResolvedValue(null)
    const m = await import("@/modules/booking/actions")
    await m.holdUnit({ workspaceId: "ws1", dealId: "d1", unitId: "u_foreign" }).catch(() => {})
    // Even on the failure path, no deal write may carry the unverified id —
    // confirmBooking trusts deal.unit and would go on to mark it BOOKED.
    for (const call of db.deal.update.mock.calls) {
      expect(call[0].data.unitId).not.toBe("u_foreign")
    }
  })

  it("holds the unit and links the deal when the unit is in the workspace", async () => {
    db.unit.findFirst.mockResolvedValue({ id: "u1" })
    const m = await import("@/modules/booking/actions")
    await m.holdUnit({ workspaceId: "ws1", dealId: "d1", unitId: "u1", hours: 24 })
    expect(db.unit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "u1", workspaceId: "ws1" }) }),
    )
    expect(db.deal.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: "ws1" }) }),
    )
  })
})

describe("createAssociation", () => {
  it("refuses without a session", async () => {
    authMock.mockResolvedValue(null)
    const m = await import("@/modules/association/actions")
    await expect(
      m.createAssociation({ name: "x", slug: "x", workspaceId: "ws_victim" }),
    ).rejects.toThrow()
    expect(db.association.create).not.toHaveBeenCalled()
    expect(db.activity.create).not.toHaveBeenCalled()
  })

  it("refuses when the caller is not a member of the target workspace", async () => {
    membershipMock.mockRejectedValue(new Error("not a member"))
    const m = await import("@/modules/association/actions")
    await expect(
      m.createAssociation({ name: "x", slug: "x", workspaceId: "ws_victim" }),
    ).rejects.toThrow()
    // Before the fix this wrote an AssociationMember OWNER row and an
    // attacker-authored NOTE into the victim workspace's timeline.
    expect(db.associationMember.create).not.toHaveBeenCalled()
    expect(db.activity.create).not.toHaveBeenCalled()
  })
})

describe("confused deputy: client-supplied userId is not the principal", () => {
  it("createFollowUps takes no userId argument", async () => {
    // The signature itself is the regression: a `userId` parameter is what let
    // an anonymous caller name someone else's identity to pass the gate.
    // `.length` is arity, so asserting on it fails if the parameter returns.
    const m: Record<string, (...args: never[]) => unknown> = await import("@/modules/ai/actions")
    expect(m.createFollowUps.length).toBeLessThanOrEqual(2)
    expect(m.getNextBestActions.length).toBeLessThanOrEqual(2)
  })

  it("poolLead/claimLead/listUnitToAssociation take no userId argument", async () => {
    const m: Record<string, (...args: never[]) => unknown> =
      await import("@/modules/association/actions")
    expect(m.poolLead.length).toBeLessThanOrEqual(3)
    expect(m.claimLead.length).toBeLessThanOrEqual(2)
    expect(m.listUnitToAssociation.length).toBeLessThanOrEqual(3)
  })

  it("createReferral takes no userId argument", async () => {
    const m: Record<string, (...args: never[]) => unknown> =
      await import("@/modules/association/actions")
    expect(m.createReferral.length).toBeLessThanOrEqual(1)
  })
})

describe("updateMemberRoleAction", () => {
  it("refuses to promote anyone to OWNER", async () => {
    const m = await import("@/lib/actions/settings")
    // An ADMIN posting role:"OWNER" passed the zod enum and only the
    // already-OWNER check stood in the way, so an admin could mint a second
    // owner and cross the isOwner() boundary on delete/billing.
    //
    // This action is wrapped in handleAction, so it *resolves* with a Result
    // error rather than rejecting — assert on the resolved shape. The
    // authoritative assertion is the second one: no role was written.
    const res = await m.updateMemberRoleAction("ws1", "u_attacker", "OWNER" as never)
    expect(res).toMatchObject({ error: { code: "FORBIDDEN" } })
    expect(db.workspaceMember.update).not.toHaveBeenCalled()
  })
})