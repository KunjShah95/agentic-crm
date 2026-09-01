import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    unit: { findMany: vi.fn().mockResolvedValue([]) },
    project: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { listUnits } from "@/modules/property/queries"
import { db } from "@/lib/db"

describe("isolation", () => {
  it("listUnits is defined and filters by workspaceId", async () => {
    expect(listUnits).toBeDefined()
    expect(typeof listUnits).toBe("function")
  })

  it("listUnits passes workspaceId to db query", async () => {
    vi.mocked(db.unit.findMany).mockClear()
    await listUnits("w1")
    expect(db.unit.findMany).toHaveBeenCalled()
    const arg = (db.unit.findMany as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.where.workspaceId).toBe("w1")
  })

  it("listUnits isolates different workspaces", async () => {
    vi.mocked(db.unit.findMany).mockClear()
    await listUnits("w-other", { projectId: "p1" })
    const arg = (db.unit.findMany as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.where.workspaceId).toBe("w-other")
    expect(arg.where.projectId).toBe("p1")
  })
})
