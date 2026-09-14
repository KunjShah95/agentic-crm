/**
 * Commission weighting by deal type + selling urgency ("company take").
 *
 * Base rates follow typical Ahmedabad / REDA-style market practice:
 * harder-to-sell categories pay the channel more, which is also the
 * company's expected take on a won deal. Urgency adds a further uplift —
 * distress inventory must move, so the sales incentive is weighted up.
 *
 * Effective % = base rate for the type + urgency uplift (never below 0).
 */

export const DEAL_TYPES = [
  "PLOT",
  "VILLA",
  "BUNGALOW",
  "FLAT",
  "SHOP",
  "COMMERCIAL",
  "OFFICE",
  "CORPORATE_HOUSE",
] as const
export type DealType = (typeof DEAL_TYPES)[number]

export const URGENCY_LEVELS = ["NONE", "LOW", "NORMAL", "HIGH", "DISTRESS"] as const
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number]

/** Default commission % of deal value, per category. */
export const BASE_COMMISSION_PCT: Record<DealType, number> = {
  PLOT: 3.0, // land — longest sale cycle, highest incentive
  VILLA: 2.5,
  BUNGALOW: 2.5,
  FLAT: 2.0, // BHK1–4 apartments — fastest moving
  SHOP: 2.0,
  COMMERCIAL: 2.0,
  OFFICE: 1.5,
  CORPORATE_HOUSE: 1.5, // bulk/ institutional deals — big ticket, thin %
}

/** Percentage-point adjustment applied on top of the base rate. */
export const URGENCY_UPLIFT_PP: Record<UrgencyLevel, number> = {
  NONE: 0,
  LOW: -0.25, // hot inventory doesn't need extra push
  NORMAL: 0,
  HIGH: 0.5,
  DISTRESS: 1.0, // must-move stock: strongest pull
}

/** Map the UnitConfig enum on a linked unit to a commission category. */
export function dealTypeFromUnitConfig(config?: string | null): DealType | null {
  switch (config) {
    case "PLOT":
      return "PLOT"
    case "VILLA":
      return "VILLA"
    case "BHK1":
    case "BHK2":
    case "BHK3":
    case "BHK4":
      return "FLAT"
    case "SHOP":
      return "SHOP"
    case "OFFICE":
      return "OFFICE"
    default:
      return null
  }
}

export function normalizeDealType(value?: string | null, unitConfig?: string | null): DealType {
  if (value && (DEAL_TYPES as readonly string[]).includes(value)) return value as DealType
  return dealTypeFromUnitConfig(unitConfig) ?? "FLAT"
}

export function normalizeUrgency(value?: string | null): UrgencyLevel {
  if (value && (URGENCY_LEVELS as readonly string[]).includes(value)) return value as UrgencyLevel
  return "NORMAL"
}

/** Effective commission % for a category + urgency combination. */
export function effectiveCommissionPct(dealType: DealType, urgency: UrgencyLevel): number {
  return Math.max(0, BASE_COMMISSION_PCT[dealType] + URGENCY_UPLIFT_PP[urgency])
}

/** Expected company take (₹) on a deal of the given value. */
export function expectedCommission(
  value: number,
  dealType: DealType,
  urgency: UrgencyLevel
): number {
  return Math.round((value * effectiveCommissionPct(dealType, urgency)) / 100)
}
