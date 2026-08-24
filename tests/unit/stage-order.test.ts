import { describe, expect, it } from "vitest"

// Pure stage ordering logic — mirrors reorderStagesAction offset strategy
function reorder<T extends { id: string }>(stages: T[], from: number, to: number): T[] {
  const copy = [...stages]
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}

describe("stage ordering", () => {
  const stages = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]

  it("moves forward", () => {
    expect(reorder(stages, 0, 2).map((s) => s.id)).toEqual(["b", "c", "a", "d"])
  })

  it("moves backward", () => {
    expect(reorder(stages, 3, 0).map((s) => s.id)).toEqual(["d", "a", "b", "c"])
  })

  it("is no-op when from==to", () => {
    expect(reorder(stages, 1, 1).map((s) => s.id)).toEqual(["a", "b", "c", "d"])
  })

  it("offset strategy yields sequential order", () => {
    const OFFSET = 10_000
    const orderedIds = reorder(stages, 1, 3).map((s) => s.id) // ["a","c","d","b"]
    // Simulate two-pass transaction
    const temp: Record<string, number> = {}
    for (let i = 0; i < orderedIds.length; i++) temp[orderedIds[i]] = OFFSET + i
    const final: Record<string, number> = {}
    for (let i = 0; i < orderedIds.length; i++) final[orderedIds[i]] = i
    expect(final).toEqual({ a: 0, c: 1, d: 2, b: 3 })
  })
})
