/**
 * Today brief — the daily command center aggregator (#3).
 *
 * All queries are workspace-isolated (data-integrity rule #36). On this branch
 * the Today page replaces the generic Dashboard as the default landing page:
 * instead of "open a table, read counts", the user sees exactly the work
 * surfaced for today — hot leads needing a call, overdue follow-ups, today's
 * site visits, deals going cold, and payments due.
 */

import { db } from "@/lib/db"
import { buildSignal, type Temperature } from "@/lib/signals"

const HOUR = 3_600_000
const DAY = 24 * HOUR

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfToday(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from.getTime())
  d.setDate(d.getDate() + days)
  return d
}

export type TodayHotLead = {
  contactId: string
  name: string
  phone: string | null
  score: number | null
  heatScore: number
  temperature: Temperature
  reasons: string[]
  recommendedAction: string
  ctaLabel: string
  lastActivityAt: Date | null
}

export type TodayFollowUp = {
  id: string
  body: string | null
  scheduledAt: Date
  contactName: string | null
  dealTitle: string | null
}

export type TodayVisit = {
  id: string
  scheduledAt: Date
  contactName: string
  contactId: string
  checkedIn: boolean
  unitNo: string | null
  projectName: string | null
}

export type TodayAtRiskDeal = {
  id: string
  title: string
  value: number | null
  stageName: string
  daysSinceActivity: number
}

export type TodayPaymentDue = {
  id: string
  amount: number
  dueDate: Date | null
  dealTitle: string
  contactName: string | null
}

export type TodayBrief = {
  hotLeads: TodayHotLead[]
  followUps: TodayFollowUp[]
  visits: TodayVisit[]
  atRiskDeals: TodayAtRiskDeal[]
  paymentsDue: TodayPaymentDue[]
  progress: { done: number; total: number }
}

const TERMINAL_STAGES = /won|lost|closed|sold|booked/i
export async function getTodayBrief(workspaceId: string): Promise<TodayBrief> {
  const now = new Date()
  const staleCutoff = new Date(now.getTime() - 7 * DAY)

  const [
    hotContactRows,
    overdueRows,
    visitRows,
    staleDealRows,
    recentActivityRows,
    paymentRows,
    todayActivityRows,
  ] = await Promise.all([
    db.contact.findMany({
      where: { workspaceId, leadScore: { gte: 60 } },
      orderBy: { leadScore: "desc" },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        leadScore: true,
        activities: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    db.activity.findMany({
      where: {
        workspaceId,
        type: "TASK",
        scheduledAt: { lte: endOfToday(), not: null },
        completedAt: null,
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, title: true } },
      },
    }),
    db.siteVisit.findMany({
      where: { workspaceId, scheduledAt: { gte: startOfToday(), lte: endOfToday() } },
      orderBy: { scheduledAt: "asc" },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        deal: {
          select: {
            id: true,
            unit: { select: { unitNo: true, project: { select: { name: true } } } },
          },
        },
      },
    }),
    db.deal.findMany({
      where: { workspaceId, updatedAt: { lt: staleCutoff } },
      orderBy: { updatedAt: "asc" },
      take: 10,
      include: { stage: { select: { name: true } } },
    }),
    db.activity.findMany({
      where: { workspaceId, createdAt: { gte: staleCutoff }, dealId: { not: null } },
      select: { dealId: true },
    }),
    db.payment.findMany({
      where: {
        workspaceId,
        status: "DUE",
        paidAt: null,
        dueDate: { not: null, lte: addDays(endOfToday(), 3) },
      },
      orderBy: { dueDate: "asc" },
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            contact: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    db.activity.findMany({
      where: { workspaceId, createdAt: { gte: startOfToday() } },
      select: { completedAt: true },
    }),
  ])

  // 🔥 Hot leads that need a call — high score but no touchpoint in 24h (or none yet).
  const hotLeads: TodayHotLead[] = []
  for (const c of hotContactRows) {
    const hoursSince = c.activities[0]?.createdAt
      ? (now.getTime() - new Date(c.activities[0].createdAt).getTime()) / HOUR
      : null
    if (hoursSince != null && hoursSince <= 24) continue
    const signal = buildSignal({ leadScore: c.leadScore, hoursSinceContact: hoursSince })
    hotLeads.push({
      contactId: c.id,
      name: `${c.firstName}${c.lastName ? ` ${c.lastName}` : ""}`.trim(),
      phone: c.phone,
      score: c.leadScore,
      heatScore: signal.heatScore,
      temperature: signal.temperature,
      reasons: signal.reasons,
      recommendedAction: signal.recommendedAction,
      ctaLabel: signal.ctaLabel,
      lastActivityAt: c.activities[0]?.createdAt ?? null,
    })
  }

  // 🟠 Overdue follow-ups — scheduled before end of today, not completed.
  const followUps: TodayFollowUp[] = overdueRows.map((t) => ({
    id: t.id,
    body: t.body,
    scheduledAt: t.scheduledAt!,
    contactName: t.contact ? `${t.contact.firstName}${t.contact.lastName ? ` ${t.contact.lastName}` : ""}`.trim() : null,
    dealTitle: t.deal?.title ?? null,
  }))

  // 📅 Today's site visits (timeline).
  const visits: TodayVisit[] = visitRows.map((v) => ({
    id: v.id,
    scheduledAt: v.scheduledAt,
    contactName: `${v.lead.firstName}${v.lead.lastName ? ` ${v.lead.lastName}` : ""}`.trim(),
    contactId: v.lead.id,
    checkedIn: !!v.checkedInAt,
    unitNo: v.deal?.unit?.unitNo ?? null,
    projectName: v.deal?.unit?.project?.name ?? null,
  }))

  // ⚠️ Deals at risk — no update for 7+ days and no activity to match.
  const recentDealIds = new Set<string>()
  for (const a of recentActivityRows) if (a.dealId) recentDealIds.add(a.dealId)
  const atRiskDeals: TodayAtRiskDeal[] = staleDealRows
    .filter((d) => !d.stage || !TERMINAL_STAGES.test(d.stage.name))
    .filter((d) => !recentDealIds.has(d.id))
    .map((d) => ({
      id: d.id,
      title: d.title,
      value: d.value,
      stageName: d.stage?.name ?? "—",
      daysSinceActivity: Math.max(0, Math.round((now.getTime() - d.updatedAt.getTime()) / DAY)),
    }))

  // 💸 Payments due within the next 3 days.
  const paymentsDue: TodayPaymentDue[] = paymentRows.map((p) => ({
    id: p.id,
    amount: p.amount,
    dueDate: p.dueDate,
    dealTitle: p.deal.title,
    contactName: p.deal.contact
      ? `${p.deal.contact.firstName}${p.deal.contact.lastName ? ` ${p.deal.contact.lastName}` : ""}`.trim()
      : null,
  }))

  // Daily progress: how many important items are already finished today.
  const done =
    visits.filter((v) => v.checkedIn).length +
    todayActivityRows.filter((a) => a.completedAt).length
  const total =
    hotLeads.length + followUps.length + visits.length + atRiskDeals.length + paymentsDue.length

  return {
    hotLeads: hotLeads.slice(0, 6),
    followUps: followUps.slice(0, 6),
    visits: visits.slice(0, 6),
    atRiskDeals: atRiskDeals.slice(0, 6),
    paymentsDue: paymentsDue.slice(0, 6),
    progress: { done, total },
  }
}