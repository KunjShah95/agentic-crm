/**
 * Deal RE lifecycle stage machine. Forward-only: a deal may advance to any
 * later stage (adjacent or skipping) but never move backward. Pure.
 */

export const RE_STAGES = [
  "INQUIRY",
  "VISIT",
  "NEGOTIATION",
  "HOLD",
  "BOOKING",
  "REGISTRATION",
  "POSSESSION",
  "CLOSED",
] as const

export type BookingStage = (typeof RE_STAGES)[number]

export function isBookingStage(s: string): s is BookingStage {
  return (RE_STAGES as readonly string[]).includes(s)
}

export function canTransition(from: string, to: string): boolean {
  const fi = RE_STAGES.indexOf(from as BookingStage)
  const ti = RE_STAGES.indexOf(to as BookingStage)
  if (fi === -1 || ti === -1) return false
  return ti > fi
}

export function nextStage(from: string): BookingStage | null {
  const fi = RE_STAGES.indexOf(from as BookingStage)
  if (fi === -1 || fi === RE_STAGES.length - 1) return null
  return RE_STAGES[fi + 1]
}
