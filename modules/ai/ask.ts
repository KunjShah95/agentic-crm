/**
 * "Ask your pipeline" — structured, read-only, workspace-scoped Jarvis parity.
 * No LLM required for deterministic queries; pattern-matches common intents
 * and runs scoped Prisma reads. Returns a short answer + rows for the UI.
 */

import { db } from "@/lib/db"

export type AskResult = {
  answer: string
  rows?: Array<Record<string, unknown>>
  meta?: Record<string, unknown>
}

const reDeals = /\b(deals?|pipeline)\b/i
const reContacts = /\b(contacts?|leads?)\b/i
const reOverdue = /\boverdue\b/i
const reFunnel = /\bfunnel\b/i

export async function askPipeline(workspaceId: string, q: string): Promise<AskResult> {
  const lower = q.toLowerCase()

  if (reFunnel.test(q)) {
    const deals = await db.deal.findMany({ where: { workspaceId }, select: { bookingStage: true } })
    const counts: Record<string, number> = {}
    for (const d of deals) counts[d.bookingStage ?? "INQUIRY"] = (counts[d.bookingStage ?? "INQUIRY"] ?? 0) + 1
    return { answer: `Funnel has ${deals.length} deals.`, rows: Object.entries(counts).map(([stage, count]) => ({ stage, count })) }
  }

  if (reOverdue.test(q)) {
    const payments = await db.payment.findMany({
      where: { workspaceId, status: { in: ["OVERDUE", "DUE"] } },
      select: { amount: true, dueDate: true, status: true, dealId: true },
      take: 20,
    })
    const overdue = payments.filter((p) => p.status === "OVERDUE" || (p.dueDate && new Date(p.dueDate) < new Date()))
    return { answer: `${overdue.length} overdue payments — total ₹${overdue.reduce((s, p) => s + p.amount, 0).toLocaleString("en-IN")}.`, rows: overdue as unknown as Array<Record<string, unknown>> }
  }

  if (reDeals.test(q) && !reContacts.test(q)) {
    const take = 10
    const deals = await db.deal.findMany({
      where: { workspaceId, ...(lower.includes("closing") ? { bookingStage: "CLOSING" as never } : {}) },
      take,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, bookingStage: true, value: true },
    })
    return { answer: `Top ${deals.length} deals in this workspace.`, rows: deals as unknown as Array<Record<string, unknown>> }
  }

  if (reContacts.test(q)) {
    const contacts = await db.contact.findMany({
      where: { workspaceId },
      take: 10,
      orderBy: { updatedAt: "desc" },
      select: { id: true, firstName: true, lastName: true, leadSource: true, leadScore: true },
    })
    return { answer: `Recent ${contacts.length} contacts.`, rows: contacts as unknown as Array<Record<string, unknown>> }
  }

  // fallback: inventory count
  if (/inventory|units?|available/i.test(q)) {
    const units = await db.unit.groupBy({ by: ["status"], where: { workspaceId }, _count: { status: true } })
    return { answer: `Inventory by status.`, rows: units as unknown as Array<Record<string, unknown>> }
  }

  return { answer: "Try: “show funnel”, “overdue payments”, “recent deals”, “recent contacts”, or “inventory by status”.", meta: { workspaceId } }
}
