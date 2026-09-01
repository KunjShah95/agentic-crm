/**
 * Lead scoring 0-100 for RE leads.
 * Pure function — inputs: source, intent, config, budget, locality match.
 * Higher score = hotter lead. Used by worker to prioritize + route.
 */

export type LeadScoreInput = {
  source?: string
  intent?: string
  config?: string
  budgetMin?: number
  budgetMax?: number
  locality?: string
  targetLocalities?: string[]
}

const SOURCE_POINTS: Record<string, number> = {
  WALK_IN: 25,
  WEBSITE: 20,
  META: 15,
  GOOGLE: 15,
  NINETY_NINE_ACRES: 12,
  MAGIC_BRICKS: 12,
  HOUSING: 10,
  NOBROKER: 8,
  PABBLY: 5,
}

const INTENT_POINTS: Record<string, number> = {
  HOT: 20,
  BUY: 20,
  INVESTMENT: 15,
  WARM: 10,
  COLD: 0,
}

const BASE = 30

export function calcLeadScore(input: LeadScoreInput): number {
  let score = BASE
  const source = (input.source ?? "").toUpperCase()
  const intent = (input.intent ?? "").toUpperCase()
  score += SOURCE_POINTS[source] ?? 0
  score += INTENT_POINTS[intent] ?? 0
  if (input.config) score += 10
  if ((input.budgetMax ?? 0) > 0) score += 10
  if (input.locality && input.targetLocalities?.length) {
    const loc = input.locality.trim().toLowerCase()
    if (input.targetLocalities.some((t) => t.trim().toLowerCase() === loc)) score += 15
  }
  return Math.max(0, Math.min(100, Math.round(score)))
}
