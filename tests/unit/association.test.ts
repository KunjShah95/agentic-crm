import { describe, it, expect } from "vitest"
import fs from "fs"

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
