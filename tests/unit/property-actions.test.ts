import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    project: { create: vi.fn().mockResolvedValue({ id: "p1", name: "Sun Residency", workspaceId: "w1" }), findMany: vi.fn(), findFirst: vi.fn().mockResolvedValue({ id: "p1", name: "Sun Residency", workspaceId: "w1" }) },
    tower: { create: vi.fn().mockResolvedValue({ id: "t1", name: "Tower A" }), findFirst: vi.fn().mockResolvedValue({ id: "t1", name: "Tower A", project: { workspaceId: "w1" } }) },
    /* Echoes the created row's input rather than a fixed literal. With a hardcoded
     `number: 1` the mock made every floor indistinguishable, so an assertion that
     the floor number reached the audit row would pass no matter what number was
     requested. */
    floor: { create: vi.fn(async ({ data }: { data: { number: number } }) => ({ id: "f1", ...data })) },
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

import { createProject, createFloor } from "@/modules/property/actions"
import { db } from "@/lib/db"

describe("property actions", () => {
  /* The `db` doubles are module-level and shared across the file, so call counts
     accumulate. Without this, `createProject`'s audit row is still in the history
     when `createFloor` runs and the assertion about *not* writing on a rejected
     cross-tenant floor passes for the wrong reason — or fails for the wrong one.
     `clearAllMocks` rather than `resetAllMocks`, so the `mockResolvedValue`
     implementations set up above survive. */
  beforeEach(() => vi.clearAllMocks())

  it("createProject validates auth", async () => {
    const r = await createProject({ workspaceId: "w1", data: { name: "Sun Residency" } })
    expect(r).toBeDefined()
    expect(r.name).toBe("Sun Residency")
  })

  /**
   * `createFloor` was the one structural mutation in this module with no audit
   * row, so a project's timeline showed towers and units appearing with no floors
   * between them. Asserted because the omission was invisible: nothing failed, the
   * row was simply never written.
   */
  it("createFloor writes an audit activity row", async () => {
    const floor = await createFloor({ workspaceId: "w1", data: { towerId: "t1", number: 3 } })

    expect(floor.number).toBe(3)
    expect(db.activity.create).toHaveBeenCalledTimes(1)

    const row = (db.activity.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data
    expect(row.workspaceId).toBe("w1")
    expect(row.type).toBe("NOTE")
    expect(row.createdBy).toBe("u1")
    /* `Floor` has no name column, so the body has to identify the floor by tower
       and number. This asserts it does rather than rendering "undefined" — the
       failure mode if `floor.name` had been reached for. */
    expect(row.body).toContain("Tower A")
    expect(row.body).toContain("3")
    expect(row.body).not.toContain("undefined")
  })

  it("createFloor does not write the row for a tower in another workspace", async () => {
    ;(db.tower.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "t9",
      name: "Tower Z",
      project: { workspaceId: "other-workspace" },
    })

    await expect(
      createFloor({ workspaceId: "w1", data: { towerId: "t9", number: 1 } }),
    ).rejects.toThrow(/not found in this workspace/i)

    /* The tenant check has to run before the write, or a rejected floor still
       leaves an activity row naming a tower the caller was not allowed to touch. */
    expect(db.activity.create).not.toHaveBeenCalled()
  })
})
