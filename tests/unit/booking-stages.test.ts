import { describe, it, expect } from "vitest"
import { RE_STAGES, canTransition, nextStage, isBookingStage } from "@/modules/booking/stages"

describe("booking stage machine", () => {
  it("has the RE lifecycle in order", () => {
    expect(RE_STAGES).toEqual(["INQUIRY", "VISIT", "NEGOTIATION", "HOLD", "BOOKING", "REGISTRATION", "POSSESSION", "CLOSED"])
  })

  it("allows forward transitions (adjacent and skipping)", () => {
    expect(canTransition("INQUIRY", "VISIT")).toBe(true)
    expect(canTransition("INQUIRY", "BOOKING")).toBe(true)
    expect(canTransition("HOLD", "BOOKING")).toBe(true)
  })

  it("blocks backward transitions", () => {
    expect(canTransition("BOOKING", "HOLD")).toBe(false)
    expect(canTransition("CLOSED", "POSSESSION")).toBe(false)
  })

  it("blocks unknown stages and no-op", () => {
    expect(canTransition("INQUIRY", "INQUIRY")).toBe(false)
    expect(canTransition("FOO", "VISIT")).toBe(false)
  })

  it("nextStage returns the following stage, null at end", () => {
    expect(nextStage("INQUIRY")).toBe("VISIT")
    expect(nextStage("CLOSED")).toBeNull()
  })

  it("isBookingStage validates membership", () => {
    expect(isBookingStage("HOLD")).toBe(true)
    expect(isBookingStage("nope")).toBe(false)
  })
})
