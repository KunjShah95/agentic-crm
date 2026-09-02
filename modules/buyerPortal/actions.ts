"use server"

import { db } from "@/lib/db"
import crypto from "crypto"

export async function createBuyerAccess(workspaceId: string, contactId: string, daysValid: number = 30) {
  const token = crypto.randomBytes(24).toString("hex")
  const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000)
  return db.buyerPortalAccess.create({ data: { workspaceId, contactId, token, expiresAt } })
}

export async function getBuyerPortal(token: string) {
  const access = await db.buyerPortalAccess.findUnique({ where: { token }, include: { contact: true, workspace: true } })
  if (!access) return null
  if (access.expiresAt < new Date()) return null
  await db.buyerPortalAccess.update({ where: { token }, data: { lastSeenAt: new Date() } })
  const deals = await db.deal.findMany({ where: { contactId: access.contactId, workspaceId: access.workspaceId }, include: { unit: true, payments: true, costSheet: true } })
  const docs = await db.generatedDocument.findMany({ where: { workspaceId: access.workspaceId, contactId: access.contactId } as never, take: 20, orderBy: { createdAt: "desc" } }).catch(() => [] as never[])
  // fallback: docs by deal
  const dealDocs = deals.length ? await db.generatedDocument.findMany({ where: { workspaceId: access.workspaceId, dealId: { in: deals.map((d) => d.id) } }, take: 20 }) : []
  return { access, deals, docs: (docs as unknown as { length: number }).length ? docs : dealDocs }
}
