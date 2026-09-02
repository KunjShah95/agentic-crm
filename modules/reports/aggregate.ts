/**
 * Reports aggregation engine (M4 Phase 4.3). Pure functions only — each takes
 * plain typed arrays and returns computed aggregates with zero DB access, so
 * they are trivially unit-testable. Percentages are rounded to 1 decimal.
 */

const round1 = (n: number): number => Math.round(n * 10) / 10

/** Canonical real-estate booking stages in funnel order. */
export const FUNNEL_STAGES = [
  "INQUIRY",
  "VISIT",
  "NEGOTIATION",
  "HOLD",
  "BOOKING",
  "REGISTRATION",
  "POSSESSION",
  "CLOSED",
] as const

export type FunnelRow = { stage: string; count: number; conversionPct: number }

export function funnel(deals: { bookingStage: string | null }[]): FunnelRow[] {
  const counts: Record<string, number> = {}
  for (const stage of FUNNEL_STAGES) counts[stage] = 0
  for (const d of deals) {
    const stage = d.bookingStage ?? "INQUIRY"
    if (stage in counts) counts[stage] += 1
  }
  const base = counts["INQUIRY"]
  return FUNNEL_STAGES.map((stage) => ({
    stage,
    count: counts[stage],
    conversionPct: base > 0 ? round1((counts[stage] / base) * 100) : 0,
  }))
}

export type InventoryHealth = {
  total: number
  available: number
  hold: number
  booked: number
  sold: number
  soldPct: number
}

export function inventoryHealth(units: { status: string }[]): InventoryHealth {
  let available = 0
  let hold = 0
  let booked = 0
  let sold = 0
  for (const u of units) {
    if (u.status === "AVAILABLE") available += 1
    else if (u.status === "HOLD") hold += 1
    else if (u.status === "BOOKED") booked += 1
    else if (u.status === "SOLD") sold += 1
  }
  const total = units.length
  return {
    total,
    available,
    hold,
    booked,
    sold,
    soldPct: total > 0 ? round1(((booked + sold) / total) * 100) : 0,
  }
}

export type CollectionsSummary = {
  due: number
  paid: number
  overdue: number
  total: number
  overduePct: number
}

export function collections(
  payments: { status: string; amount: number; dueDate?: string | Date | null }[],
  now: Date = new Date(),
): CollectionsSummary {
  let due = 0
  let paid = 0
  let overdue = 0
  for (const p of payments) {
    let status = p.status
    if (status === "DUE" && p.dueDate != null) {
      const d = p.dueDate instanceof Date ? p.dueDate : new Date(p.dueDate)
      if (d.getTime() < now.getTime()) status = "OVERDUE"
    }
    if (status === "PAID") paid += p.amount
    else if (status === "OVERDUE") overdue += p.amount
    else if (status === "DUE") due += p.amount
  }
  const total = due + paid + overdue
  return {
    due,
    paid,
    overdue,
    total,
    overduePct: total > 0 ? round1((overdue / total) * 100) : 0,
  }
}

export type SourceROIRow = {
  source: string
  leads: number
  bookings: number
  revenue: number
  conversionPct: number
}

export function sourceROI(
  rows: { source: string; isBooking: boolean; revenue: number }[],
): SourceROIRow[] {
  const grouped: Record<string, { leads: number; bookings: number; revenue: number }> = {}
  for (const r of rows) {
    const g = (grouped[r.source] ??= { leads: 0, bookings: 0, revenue: 0 })
    g.leads += 1
    if (r.isBooking) g.bookings += 1
    g.revenue += r.revenue
  }
  return Object.entries(grouped)
    .map(([source, g]) => ({
      source,
      leads: g.leads,
      bookings: g.bookings,
      revenue: g.revenue,
      conversionPct: g.leads > 0 ? round1((g.bookings / g.leads) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export type TeamTargetRow = {
  ownerId: string
  ownerName: string
  bookings: number
  target: number
  attainmentPct: number
}

export function teamVsTarget(
  rows: { ownerId: string; ownerName: string; bookings: number; target: number }[],
): TeamTargetRow[] {
  return rows
    .map((r) => ({
      ownerId: r.ownerId,
      ownerName: r.ownerName,
      bookings: r.bookings,
      target: r.target,
      attainmentPct: r.target > 0 ? round1((r.bookings / r.target) * 100) : 0,
    }))
    .sort((a, b) => b.attainmentPct - a.attainmentPct)
}
