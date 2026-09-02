import { describe, it, expect } from "vitest"
import { brokerScopeFilter } from "@/lib/permissions"

describe("brokerScopeFilter", () => {
  it("narrows BROKER-role users to their own brokerId", () => {
    expect(brokerScopeFilter("BROKER", "cp-1")).toEqual({ brokerId: "cp-1" })
  })
  it("gives a BROKER with no linked record an unmatchable filter", () => {
    expect(brokerScopeFilter("BROKER", null)).toEqual({ brokerId: "__no_broker__" })
  })
  it("does not scope OWNER/ADMIN/MEMBER/SALES/VIEWER", () => {
    for (const r of ["OWNER", "ADMIN", "MEMBER", "SALES", "VIEWER"] as const) {
      expect(brokerScopeFilter(r, "cp-1")).toEqual({})
    }
  })
})
