import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    project: { create: vi.fn().mockResolvedValue({ id: "p1", name: "Sun Residency", workspaceId: "w1" }), findMany: vi.fn() },
    tower: { create: vi.fn().mockResolvedValue({ id: "t1", name: "Tower A" }) },
    floor: { create: vi.fn().mockResolvedValue({ id: "f1", number: 1 }) },
    unit: { create: vi.fn().mockResolvedValue({ id: "u1", unitNo: "A-101" }), findMany: vi.fn(), update: vi.fn().mockResolvedValue({ id: "u1", unitNo: "A-101", status: "HOLD" }) },
    activity: { create: vi.fn().mockResolvedValue({ id: "a1" }) },
    workspaceMember: { findUnique: vi.fn().mockResolvedValue({ role: "OWNER", workspace: { slug: "test", name: "Test" } }) },
  },
}))
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }) }))
vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/permissions")>("@/lib/permissions")
  return { ...actual, requireWorkspaceMember: vi.fn().mockResolvedValue({ role: "OWNER", workspaceId: "w1", workspace: { slug: "test", name: "Test" } }) }
})
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { createProject } from "@/modules/property/actions"

describe("property actions", () => {
  it("createProject validates auth", async () => {
    const r = await createProject({ workspaceId: "w1", data: { name: "Sun Residency" } })
    expect(r).toBeDefined()
    expect(r.name).toBe("Sun Residency")
  })
})
