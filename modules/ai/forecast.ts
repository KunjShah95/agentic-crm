/**
 * Forecast — revenue & collections from payments + stage probability.
 * Pure, TDD-friendly. Stage probability table is RE-specific.
 */

const STAGE_PROB: Record<string, number> = {
  INQUIRY: 0.05,
  VISIT: 0.15,
  NEGOTIATION: 0.35,
  HOLD: 0.6,
  BOOKING: 0.85,
  REGISTRATION: 0.92,
  POSSESSION: 0.97,
  CLOSED: 1,
}

export function stageProbability(stage: string | null | undefined): number {
  if (!stage) return 0.05
  return STAGE_PROB[stage.toUpperCase()] ?? 0.1
}

export function revenueForecast(
  deals: { bookingStage?: string | null; value?: number | null }[],
): { weighted: number; pipeline: number; count: number } {
  let weighted = 0
  let pipeline = 0
  for (const d of deals) {
    const v = d.value ?? 0
    pipeline += v
    weighted += v * stageProbability(d.bookingStage)
  }
  return { weighted: Math.round(weighted), pipeline: Math.round(pipeline), count: deals.length }
}

export function collectionForecast(
  payments: { status: string; amount: number; dueDate?: string | Date | null }[],
  now: Date = new Date(),
): { due30: number; overdue: number; nextDueDate: string | null } {
  let due30 = 0
  let overdue = 0
  let nextDue: Date | null = null
  for (const p of payments) {
    const due = p.dueDate ? new Date(p.dueDate) : null
    if (p.status === "PAID") continue
    if (p.status === "OVERDUE" || (p.status === "DUE" && due && due.getTime() < now.getTime())) {
      overdue += p.amount
    } else if (due) {
      const diff = due.getTime() - now.getTime()
      if (diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000) {
        due30 += p.amount
        if (!nextDue || due.getTime() < nextDue.getTime()) nextDue = due
      }
    }
  }
  return { due30: Math.round(due30), overdue: Math.round(overdue), nextDueDate: nextDue ? nextDue.toISOString().slice(0, 10) : null }
}
