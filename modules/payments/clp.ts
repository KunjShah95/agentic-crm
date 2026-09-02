/**
 * Construction-Linked Plan (CLP) generation — split a unit total across payment
 * milestones by percentage. Pure. Amounts are rounded to whole rupees and the
 * last milestone absorbs any rounding remainder so the sum equals the total exactly.
 */

export type MilestoneTemplate = { label: string; pct: number; dueTrigger?: string; daysAfter?: number }
export type GeneratedMilestone = { label: string; pct: number; amount: number; order: number; dueTrigger?: string; daysAfter?: number }

/** Standard 8-stage Gujarat CLP (sums to 100%). */
export const DEFAULT_CLP: MilestoneTemplate[] = [
  { label: "On Booking", pct: 10, dueTrigger: "BOOKING", daysAfter: 0 },
  { label: "On Agreement", pct: 15, dueTrigger: "AGREEMENT", daysAfter: 15 },
  { label: "On Foundation", pct: 15, dueTrigger: "FOUNDATION", daysAfter: 0 },
  { label: "On Plinth", pct: 10, dueTrigger: "PLINTH", daysAfter: 0 },
  { label: "On Slab Casting", pct: 20, dueTrigger: "SLABS", daysAfter: 0 },
  { label: "On Brickwork", pct: 10, dueTrigger: "BRICKWORK", daysAfter: 0 },
  { label: "On Finishing", pct: 15, dueTrigger: "FINISHING", daysAfter: 0 },
  { label: "On Possession", pct: 5, dueTrigger: "POSSESSION", daysAfter: 0 },
]

export function generateCLP(total: number, milestones: MilestoneTemplate[]): GeneratedMilestone[] {
  const rows: GeneratedMilestone[] = milestones.map((m, i) => ({
    label: m.label,
    pct: m.pct,
    amount: Math.round((total * m.pct) / 100),
    order: i,
    dueTrigger: m.dueTrigger,
    daysAfter: m.daysAfter,
  }))
  if (rows.length) {
    const allocated = rows.slice(0, -1).reduce((a, r) => a + r.amount, 0)
    rows[rows.length - 1].amount = total - allocated
  }
  return rows
}
