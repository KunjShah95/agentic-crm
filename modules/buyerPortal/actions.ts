"use server"

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { PermissionError } from "@/lib/errors"
import crypto from "crypto"

/** Upper bound on a portal grant. The default of 30 days is a product
 *  decision; the ceiling is a safety rail so a caller cannot mint a
 *  never-expiring credential by passing a large `daysValid`. */
const MAX_VALID_DAYS = 365

/**
 * Mint a token-scoped buyer-portal grant for one contact.
 *
 * This mints a bearer credential: the token it returns is the only thing that
 * grants read access to that contact's deals, unit, cost sheet and payments via
 * `getBuyerPortal`. It therefore needs the same gate as every other
 * authenticated write, and it needs the contact to be proven to be in the
 * caller's workspace.
 *
 * Previously this took `workspaceId` and `contactId` at face value with no
 * session check at all. Because the file carries `"use server"`, the export is
 * registered in the server-action manifest and reachable over HTTP by an
 * unauthenticated caller, who could mint (and read back the plaintext token of)
 * a grant against any workspace's contact id. Both the identity and the
 * contact are now resolved and verified here rather than trusted.
 */
export async function createBuyerAccess(
  workspaceId: string,
  contactId: string,
  daysValid: number = 30
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new PermissionError("You must be signed in to share a buyer portal.")

  // Re-uses the single app gate: confirms membership of *this* workspace, so a
  // member of workspace A cannot mint a grant inside workspace B.
  const { requireWorkspaceMember } = await import("@/lib/permissions")
  await requireWorkspaceMember(workspaceId, userId)

  // The contact must belong to the same workspace. Without this the grant would
  // point at another tenant's contact and `getBuyerPortal` would happily render
  // its deals, since it scopes by the grant's own workspaceId.
  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId },
    select: { id: true },
  })
  if (!contact) throw new PermissionError("That contact is not in this workspace.")

  const days = Number.isFinite(daysValid)
    ? Math.min(Math.max(Math.trunc(daysValid), 1), MAX_VALID_DAYS)
    : 30

  const token = crypto.randomBytes(24).toString("hex")
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  return db.buyerPortalAccess.create({ data: { workspaceId, contactId: contact.id, token, expiresAt } })
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
