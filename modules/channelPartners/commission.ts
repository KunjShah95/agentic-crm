/**
 * Single-level commission calc (MLM explicitly out of scope for M3).
 * Explicit amount wins; otherwise pct of deal value. Clamped ≥0, rounded to rupees.
 */

export function computeCommission(dealValue: number, rule: { pct?: number; amount?: number }): number {
  if (rule.amount !== undefined && rule.amount !== null) {
    return Math.max(0, Math.round(rule.amount))
  }
  if (rule.pct !== undefined && rule.pct !== null) {
    return Math.max(0, Math.round((dealValue * rule.pct) / 100))
  }
  return 0
}
