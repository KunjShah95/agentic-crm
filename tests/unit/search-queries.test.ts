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
    }
  })

  it("uses prefix_tsquery, not plainto_tsquery", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace("w1", "test")

    for (const call of db.$queryRaw.mock.calls) {
      const sql = (call[0] as unknown as string[]).join(" ? ")
      // Prefix matching is the point: plainto_tsquery matches whole lexemes
      // only, so "anj" returned nothing while "anjali" worked, which is
      // indistinguishable from a broken search box.
      expect(sql).toContain(" prefix_tsquery")
      expect(sql).not.toContain("plainto_tsquery")
    }
  })

  it("includes phone in the contact search vector", async () => {
    db.$queryRaw.mockResolvedValue([])
    await searchWorkspace("w1", "98250")

    // A sales team looks people up by the number that called, not by name.
    // Phone was absent from contact_search_tsv entirely until migration
    // 20261003120000_search_phone_prefix.
    //
    // Join the chunks: it is a tagged template, so `"phone"` lands in a chunk
    // after the ${workspaceId} interpolation rather than in chunks[0].
    const chunks = db.$queryRaw.mock.calls[0][0] as unknown as string[]
    expect(chunks.join(" ? ")).toContain('"phone"')
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
