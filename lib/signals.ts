/**
 * Lead signals engine — the brain behind "Next Best Action" (#5) and lead
 * temperature (#7).
 *
 * Pure, unit-testable helpers. Every function takes facts in, returns a
 * recommendation out. No I/O, no workspace access — callers (lib/today.ts,
 * contact detail pages) pass real data fetched with workspace isolation.
 *
 * Temperature ladder:
 *   🔥 hot     — high score or a very recent site visit, no contact in 24h
 *   🟠 warm    — decent score with a recent touchpoint
 *   🔵 nurture — active but older score, family/nurture track
 *   ⚪ cold    — everything else
 */

export type Temperature = "hot" | "warm" | "nurture" | "cold"

export type LeadFacts = {
  leadScore?: number | null
  /** Hours since the last outbound touchpoint (call / WhatsApp / email). */
  hoursSinceContact?: number | null
  /** Calendar days since the last site visit. */
  daysSinceSiteVisit?: number | null
  /** Has the cost-sheet been opened recently (days). */
  daysSinceCostSheet?: number | null
  /** True when the buyer asked about pricing/payment/documents. */
  priceQuestion?: boolean
}

export type LeadSignal = {
  temperature: Temperature
  heatScore: number // 0–100, tabular-friendly
  reasons: string[]
  recommendedAction: string
  ctaLabel: string
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n))
}

export function leadTemperature(f: LeadFacts): Temperature {
  const score = f.leadScore ?? 0
  const recentSiteVisit = f.daysSinceSiteVisit != null && f.daysSinceSiteVisit <= 3
  if (score >= 70 || recentSiteVisit) return "hot"
  if (score >= 40) return "warm"
  if (score >= 10) return "nurture"
  return "cold"
}

export function heatScore(f: LeadFacts): number {
  const score = f.leadScore ?? 0
  let h = score
  if (f.daysSinceSiteVisit != null && f.daysSinceSiteVisit <= 3) h += 15
  if (f.daysSinceCostSheet != null && f.daysSinceCostSheet <= 3) h += 5
  if (f.hoursSinceContact == null || f.hoursSinceContact > 24) h -= 10
  return clamp(Math.round(h))
}

export function buildSignal(f: LeadFacts): LeadSignal {
  const temp = leadTemperature(f)
  const reasons: string[] = []
  const score = f.leadScore ?? 0

  if (score >= 70) reasons.push(`Scored ${score}/100`)
  else if (score >= 40) reasons.push(`Scored ${score}/100 — moving`)
  if (f.daysSinceSiteVisit != null) reasons.push(f.daysSinceSiteVisit === 0 ? "Visited the site today" : `Site visit ${f.daysSinceSiteVisit}d ago`)
  if (f.daysSinceCostSheet != null && f.daysSinceCostSheet <= 7) reasons.push("Opened the cost sheet recently")
  if (f.priceQuestion) reasons.push("Asked about pricing / payment plan")
  if (f.hoursSinceContact == null) reasons.push("No follow-up recorded yet")
  else if (f.hoursSinceContact > 24) reasons.push(`No contact for ${Math.round(f.hoursSinceContact)}h`)

  const noContactNeeded = f.hoursSinceContact != null && f.hoursSinceContact <= 24

  if (temp === "hot" && !noContactNeeded) {
    return {
      temperature: temp,
      heatScore: heatScore(f),
      reasons,
      recommendedAction: "Follow up today — they are engaged and ready.",
      ctaLabel: "Call now",
    }
  }
  if (temp === "hot") {
    return {
      temperature: temp,
      heatScore: heatScore(f),
      reasons,
      recommendedAction: "Send a gentle WhatsApp nudge and re-confirm their timeline.",
      ctaLabel: "WhatsApp",
    }
  }
  if (temp === "warm") {
    return {
      temperature: temp,
      heatScore: heatScore(f),
      reasons,
      recommendedAction: "Send the cost sheet / available options and offer one visit slot.",
      ctaLabel: "Send options",
    }
  }
  if (temp === "nurture") {
    return {
      temperature: temp,
      heatScore: heatScore(f),
      reasons,
      recommendedAction: "Add them to next week's nurture touch — a project update or payment plan.",
      ctaLabel: "Schedule touch",
    }
  }
  return {
    temperature: temp,
    heatScore: heatScore(f),
    reasons,
    recommendedAction: "No action needed right now. Re-activate with a new project announcement.",
    ctaLabel: "Re-activate",
  }
}