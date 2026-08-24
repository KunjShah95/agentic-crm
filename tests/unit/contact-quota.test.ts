import { describe, it, expect, vi } from "vitest"
import { AppError } from "@/lib/errors"

describe("contact quota gate", () => {
  it("blocks contact create when quota exceeded", async () => {
    vi.resetModules()

    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn(async () => ({ user: { id: "u1" } })),
    }))
    vi.doMock("@/lib/permissions", () => ({
      requireWorkspaceMember: vi.fn(async () => ({ role: "OWNER", workspace: { slug: "acme" } })),
      canManageData: vi.fn(() => true),
    }))
    vi.doMock("@/lib/db", () => ({
      db: {
        contact: {
          create: vi.fn(async () => ({ id: "c1" })),
          findFirst: vi.fn(async () => null),
        },
      },
    }))
    vi.doMock("@/modules/billing/quota", () => ({
      requireQuota: vi.fn(async () => {
        const { AppError: FreshAppError } = await import("@/lib/errors")
        throw new FreshAppError("QUOTA_EXCEEDED", "Quota exceeded for contacts. Upgrade to continue.", 402)
      }),
    }))

    const { createContactAction } = await import("@/lib/actions/contacts")
    const res = await createContactAction("ws1", { firstName: "Over" })
    expect(res).toHaveProperty("error.code", "QUOTA_EXCEEDED")

    vi.resetModules()
    vi.doUnmock("@/lib/auth")
    vi.doUnmock("@/lib/permissions")
    vi.doUnmock("@/lib/db")
    vi.doUnmock("@/modules/billing/quota")
  })
})
