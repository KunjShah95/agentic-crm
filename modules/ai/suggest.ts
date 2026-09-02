/**
 * Phase 4.1 — AI next-best-action (pure ranking).
 * Inputs: deal stage, leadScore, days since last activity, last activity type.
 * Output: ranked { action, reason, priority } — highest priority first.
 */

export type SuggestInput = {
  leadScore?: number | null
  bookingStage?: string | null
  daysSinceLastActivity?: number | null
  lastActivityType?: string | null
  hasPhone?: boolean
  hasEmail?: boolean
}

export type SuggestedAction = {
  action: "CALL" | "WHATSAPP" | "SITE_VISIT" | "NUDGE" | "CLOSE"
  reason: string
  priority: number
}

const stageWeight: Record<string, number> = {
  INQUIRY: 10,
  VISIT: 8,
  NEGOTIATION: 12,
  HOLD: 6,
  BOOKING: 4,
  REGISTRATION: 2,
  POSSESSION: 1,
  CLOSED: 0,
}

function scoreOf(input: SuggestInput, action: SuggestedAction["action"]): number {
  let s = 0
  const score = input.leadScore ?? 50
  const stage = (input.bookingStage ?? "INQUIRY").toUpperCase()
  const idle = input.daysSinceLastActivity ?? 0

  // base stage weight
  s += stageWeight[stage] ?? 5

  if (action === "CALL") {
    s += score >= 70 ? 15 : score >= 40 ? 8 : 0
    s += idle >= 2 ? 10 : idle >= 1 ? 5 : 0
    s += input.hasPhone ? 5 : -10
  } else if (action === "WHATSAPP") {
    s += score >= 50 ? 10 : 4
    s += idle >= 1 ? 8 : 0
    s += input.hasPhone ? 8 : -5
  } else if (action === "SITE_VISIT") {
    s += stage === "VISIT" || stage === "NEGOTIATION" ? 14 : stage === "INQUIRY" && score >= 60 ? 8 : 0
    s += idle <= 7 ? 4 : 0
  } else if (action === "NUDGE") {
    s += idle >= 3 ? 12 : idle >= 1 ? 5 : 0
    s += score < 40 ? 6 : 0
  } else if (action === "CLOSE") {
    s += stage === "BOOKING" || stage === "REGISTRATION" ? 16 : 0
    s += score >= 80 ? 10 : 0
  }
  return s
}

export function suggestActions(input: SuggestInput): SuggestedAction[] {
  const candidates: SuggestedAction[] = [
    { action: "CALL", reason: "High intent + idle — call within 4h", priority: 0 },
    { action: "WHATSAPP", reason: "Share cost sheet / site-visit slot", priority: 0 },
    { action: "SITE_VISIT", reason: "Schedule visit — locality/config match", priority: 0 },
    { action: "NUDGE", reason: "Re-engage: gentle follow-up", priority: 0 },
    { action: "CLOSE", reason: "Advance to booking — docs ready", priority: 0 },
  ]

  // refine reasons per input
  if ((input.daysSinceLastActivity ?? 0) >= 4) {
    const n = candidates.find((c) => c.action === "NUDGE")!
    n.reason = `Idle ${input.daysSinceLastActivity}d — nudge before lead cools`
  }
  if ((input.leadScore ?? 0) >= 75 && input.bookingStage === "INQUIRY") {
    const c = candidates.find((c) => c.action === "CALL")!
    c.reason = "Hot lead (score ≥75) in INQUIRY — call now"
  }
  if (input.bookingStage === "HOLD") {
    const c = candidates.find((c) => c.action === "CLOSE")!
    c.reason = "On HOLD — confirm KYC & payment plan to book"
  }

  for (const c of candidates) c.priority = scoreOf(input, c.action)
  return candidates.sort((a, b) => b.priority - a.priority).slice(0, 3)
}
