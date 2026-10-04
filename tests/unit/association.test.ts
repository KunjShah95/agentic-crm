import { describe, it, expect, vi } from "vitest"
import fs from "fs"

// The action module resolves the acting user from the session via @/lib/auth,
// which pulls next-auth -> next/server. That import does not resolve under the
// vitest node/jsdom environment, so it is mocked out here for the same reason
// and in the same shape as the other action-module tests (comms-actions,
// deal-won-at, booking-flow).
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }) }))
vi.mock("@/lib/permissions", () => ({
  requireWorkspaceMember: vi.fn().mockResolvedValue({ role: "MEMBER" }),
}))
vi.mock("@/lib/db", () => ({ db: {} }))

describe("association schema", () => {
  it("defines Association and member + pooled lead + listing + referral + buyer portal", () => {
    const s = fs.readFileSync("prisma/schema.prisma", "utf8")
    expect(s).toContain("model Association")
    expect(s).toContain("model AssociationMember")
    expect(s).toContain("model AssociationLead")
    expect(s).toContain("model AssociationListing")
    expect(s).toContain("model Referral")
    expect(s).toContain("model BuyerPortalAccess")
    expect(s).toContain("AssociationLead")
    expect(s).toContain("@@unique([associationId, workspaceId])")
  })
})

describe("association actions existence", () => {
  it("exports poolLead and claimLead", async () => {
    const m = await import("@/modules/association/actions")
    expect(typeof m.poolLead).toBe("function")
    expect(typeof m.claimLead).toBe("function")
    expect(typeof m.listUnitToAssociation).toBe("function")
    expect(typeof m.createReferral).toBe("function")
  })
})
