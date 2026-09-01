import { pickAssignee, RoutingStrategy } from "@/modules/leadIngest/routing"
import { describe, it, expect } from "vitest"

const members = [
  { userId: "a", territories: ["North"] },
  { userId: "b", territories: ["South"] },
  { userId: "c", territories: [] },
]

describe("pickAssignee", () => {
  it("round-robin cycles by counter", () => {
    expect(pickAssignee(members, { strategy: "ROUND_ROBIN", counter: 0 })).toBe("a")
    expect(pickAssignee(members, { strategy: "ROUND_ROBIN", counter: 1 })).toBe("b")
    expect(pickAssignee(members, { strategy: "ROUND_ROBIN", counter: 3 })).toBe("a")
  })
  it("territory matches locality", () => {
    expect(pickAssignee(members, { strategy: "TERRITORY", locality: "North" })).toBe("a")
  })
  it("territory falls back to round-robin when no match", () => {
    expect(pickAssignee(members, { strategy: "TERRITORY", locality: "West", counter: 1 })).toBe("b")
  })
  it("returns null when no members", () => {
    expect(pickAssignee([], { strategy: "ROUND_ROBIN" })).toBeNull()
  })
})
