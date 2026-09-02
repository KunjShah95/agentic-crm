import { db } from "@/lib/db"

export async function dpdpExport(workspaceId: string) {
  const contacts = await db.contact.findMany({ where: { workspaceId }, select: { id: true, email: true, phone: true, consentAt: true, optedOut: true, createdAt: true } })
  const activities = await db.activity.findMany({ where: { workspaceId, channel: { in: ["WHATSAPP", "EMAIL", "SMS"] } }, select: { id: true, contactId: true, channel: true, direction: true, createdAt: true }, take: 500 })
  const csv = [
    ["contactId", "email", "phone", "consentAt", "optedOut", "createdAt"].join(","),
    ...contacts.map((c) => [c.id, c.email ?? "", c.phone ?? "", c.consentAt?.toISOString() ?? "", String(c.optedOut), c.createdAt.toISOString()].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    "",
    "activities",
    ["id", "contactId", "channel", "direction", "createdAt"].join(","),
    ...activities.map((a) => [a.id, a.contactId ?? "", a.channel ?? "", a.direction ?? "", a.createdAt.toISOString()].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
  ].join("\n")
  return csv
}

export function tallyCsv(payments: { dealId: string; amount: number; status: string; dueDate?: Date | null }[]): string {
  const header = ["Date", "Particulars", "Vch Type", "Amount", "Status"].join(",")
  const rows = payments.map((p) => [p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-IN") : "", p.dealId, "Receipt", String(p.amount), p.status].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
  return [header, ...rows].join("\n")
}
