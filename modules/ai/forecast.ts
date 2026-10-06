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

export interface StageBreakdown {
  stage: string
  count: number
  pipeline: number
  weighted: number
}

export function dealFunnel(
  deals: { bookingStage?: string | null; value?: number | null }[],
): StageBreakdown[] {
  const map = new Map<string, { count: number; pipeline: number; weighted: number }>()
  for (const d of deals) {
    const stage = d.bookingStage ?? "UNKNOWN"
    const v = d.value ?? 0
    const prob = stageProbability(stage)
    const entry = map.get(stage) ?? { count: 0, pipeline: 0, weighted: 0 }
    entry.count += 1
    entry.pipeline += v
    entry.weighted += v * prob
    map.set(stage, entry)
  }
  return Array.from(map.entries())
    .map(([stage, { count, pipeline, weighted }]) => ({
      stage,
      count,
      pipeline: Math.round(pipeline),
      weighted: Math.round(weighted),
    }))
    .sort((a, b) => b.weighted - a.weighted)
}

export interface TopDeal {
  id: string
  title: string
  stage: string
  value: number
  weighted: number
}

export function topDeals(
  deals: { id?: string; title?: string; bookingStage?: string | null; value?: number | null }[],
  limit = 5,
): TopDeal[] {
  return deals
    .map((d) => {
      const v = d.value ?? 0
      const prob = stageProbability(d.bookingStage)
      return {
        id: d.id ?? "",
        title: d.title ?? "Untitled",
        stage: d.bookingStage ?? "UNKNOWN",
        value: Math.round(v),
        weighted: Math.round(v * prob),
      }
    })
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, limit)
}

export interface TimelineEntry {
  id: string
  amount: number
  dueDate: string
  status: string
  dealTitle?: string
}

export function collectionsTimeline(
  payments: { id?: string; status: string; amount: number; dueDate?: string | Date | null; dealTitle?: string }[],
  now: Date = new Date(),
  days = 30,
): TimelineEntry[] {
  const cutoff = now.getTime() + days * 24 * 60 * 60 * 1000
  return payments
    .filter((p) => {
      if (p.status === "PAID") return false
      const due = p.dueDate ? new Date(p.dueDate) : null
      if (!due) return false
      const t = due.getTime()
      return t >= now.getTime() && t <= cutoff
    })
    .map((p) => ({
      id: p.id ?? "",
      amount: Math.round(p.amount),
      dueDate: new Date(p.dueDate!).toISOString().slice(0, 10),
      status: p.status,
      dealTitle: p.dealTitle,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}
