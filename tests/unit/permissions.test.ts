import { describe, expect, it } from "vitest"

import { canInvite, canManageData, hasMinRole, isOwner } from "@/lib/permissions"

describe("permissions", () => {
  describe("hasMinRole", () => {
    it("allows higher roles to satisfy lower requirements", () => {
      expect(hasMinRole("OWNER", "MEMBER")).toBe(true)
      expect(hasMinRole("ADMIN", "MEMBER")).toBe(true)
      expect(hasMinRole("OWNER", "ADMIN")).toBe(true)
    })

    it("rejects lower roles when higher is required", () => {
      expect(hasMinRole("MEMBER", "ADMIN")).toBe(false)
      expect(hasMinRole("MEMBER", "OWNER")).toBe(false)
      expect(hasMinRole("ADMIN", "OWNER")).toBe(false)
    })

    it("returns true when no minRole is required", () => {
      expect(hasMinRole("MEMBER")).toBe(true)
      expect(hasMinRole("ADMIN", undefined)).toBe(true)
    })

    it("exact role match passes", () => {
      expect(hasMinRole("ADMIN", "ADMIN")).toBe(true)
      expect(hasMinRole("OWNER", "OWNER")).toBe(true)
    })
  })

  describe("canInvite", () => {
    it("allows ADMIN and OWNER", () => {
      expect(canInvite("ADMIN")).toBe(true)
      expect(canInvite("OWNER")).toBe(true)
    })
    it("denies MEMBER", () => {
      expect(canInvite("MEMBER")).toBe(false)
    })
  })

  describe("canManageData", () => {
    it("allows ADMIN and OWNER to delete workspace data", () => {
      expect(canManageData("ADMIN")).toBe(true)
      expect(canManageData("OWNER")).toBe(true)
      expect(canManageData("MEMBER")).toBe(false)
    })
  })

  describe("isOwner", () => {
    it("only OWNER is owner", () => {
      expect(isOwner("OWNER")).toBe(true)
      expect(isOwner("ADMIN")).toBe(false)
      expect(isOwner("MEMBER")).toBe(false)
    })
  })
})
