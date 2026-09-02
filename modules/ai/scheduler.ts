/**
 * Follow-up scheduler — cadence rules per lead-score band.
 * Returns Activity payloads to create (pure, caller persists).
 */

export type ScheduleInput = {
  leadScore?: number | null
  createdAt?: Date | string | null
  now?: Date
}

export type ScheduledActivity = {
  type: "TASK" | "CALL" | "NOTE"
  body: string
  scheduledAt: Date
  channel?: string
}

function band(score: number): "hot" | "warm" | "cold" {
  if (score >= 70) return "hot"
  if (score >= 40) return "warm"
  return "cold"
}

const CADENCE: Record<"hot" | "warm" | "cold", number[]> = {
  hot: [1, 3, 7], // days
  warm: [2, 5, 10],
  cold: [3, 7, 14],
}

export function scheduleFollowUps(input: ScheduleInput): ScheduledActivity[] {
  const score = input.leadScore ?? 50
  const base = input.createdAt ? new Date(input.createdAt) : (input.now ?? new Date())
  const b = band(score)
  const gaps = CADENCE[b]
  return gaps.map((d, i) => ({
    type: i === 0 ? "CALL" : i === 1 ? "TASK" : "NOTE",
    body: i === 0 ? "Follow-up call — hot lead" : i === 1 ? "Share cost sheet on WhatsApp" : "Nudge before close",
    scheduledAt: new Date(base.getTime() + d * 24 * 60 * 60 * 1000),
    channel: i <= 1 ? "WHATSAPP" : undefined,
  }))
}
