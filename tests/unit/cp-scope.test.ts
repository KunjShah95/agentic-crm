import { describe, it, expect } from "vitest"
import { cpScopeFilter } from "@/lib/permissions"

describe("cpScopeFilter", () => {
  it("narrows CP-role users to their own cpId", () => {
    expect(cpScopeFilter("CP", "cp-1")).toEqual({ cpId: "cp-1" })
  })
  it("gives a CP with no linked record an unmatchable filter", () => {
    expect(cpScopeFilter("CP", null)).toEqual({ cpId: "__no_cp__" })
  })
  it("does not scope OWNER/ADMIN/MEMBER/SALES/VIEWER", () => {
    for (const r of ["OWNER", "ADMIN", "MEMBER", "SALES", "VIEWER"] as const) {
      expect(cpScopeFilter(r, "cp-1")).toEqual({})
    }
  })
})
