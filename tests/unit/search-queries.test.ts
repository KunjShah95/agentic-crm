import { describe, it, expect, vi } from "vitest"

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn().mockResolvedValue([{ id: "c1", name: "Hemal Shah", subtitle: "hemal@shilp.co.in" }]),
}))
vi.mock("@/lib/db", () => ({ db }))

import { searchWorkspace } from "@/modules/search/queries"

describe("searchWorkspace", () => {
  it("returns [] for empty/whitespace queries without querying", async () => {
    expect(await searchWorkspace("w1", "")).toEqual([])
    expect(await searchWorkspace("w1", "   ")).toEqual([])
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })

  it("queries contacts, orgs, and deals in parallel and maps hits", async () => {
    db.$queryRaw
      .mockResolvedValueOnce([{ id: "c1", name: "Hemal Shah", subtitle: "hemal@shilp.co.in" }])
      .mockResolvedValueOnce([{ id: "o1", name: "Shilp Infra", subtitle: "shilp.co.in" }])
      .mockResolvedValueOnce([{ id: "d1", name: "Shilp Heights 3BHK", subtitle: "INR" }])

    const hits = await searchWorkspace("w1", "hemal")

    expect(db.$queryRaw).toHaveBeenCalledTimes(3)
    expect(hits).toMatchObject([
      { type: "contact", id: "c1", name: "Hemal Shah" },
      { type: "organization", id: "o1", name: "Shilp Infra" },
      { type: "deal", id: "d1", name: "Shilp Heights 3BHK" },
    ])
  })

  it("does not reference the dropped searchVector column", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace("w1", "test")

    for (const call of db.$queryRaw.mock.calls) {
      // Tagged-template: chunks are split around ${} placeholders — join them
      const sql = (call[0] as unknown as string[]).join(" ? ")
      expect(sql).not.toContain("searchVector")
      expect(sql).toContain(" plainto_tsquery")
    }
  })

  it("scopes every query to the workspaceId", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace("w-abc", "test")

    for (const call of db.$queryRaw.mock.calls) {
      const sql = (call[0] as unknown as string[]).join(" ? ")
      expect(sql).toContain(`"workspaceId" = `)
    }
  })
})
