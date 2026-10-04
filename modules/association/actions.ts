"use server"

import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { auth } from "@/lib/auth"

/**
 * Resolve the acting user from the session and prove membership of the
 * workspace being written to.
 *
 * Every export in this file used to accept `userId` as a parameter and hand it
 * straight to `requireWorkspaceMember`. That checks whether *that user* is a
 * member — not whether *the caller* is that user. In a `"use server"` file the
 * arguments arrive as JSON from the client, so any anonymous caller could pass
 * a real member's id and pass the gate, then have actions written to that
 * member's workspace attributed to them: pooled leads taken from their
 * contacts, claimed leads, referral rows, association memberships.
 *
 * The identity now comes from the session, which is the same `authed()` shape
 * every other action module in this codebase already uses (booking, payments,
 * property, siteVisits, comms, contacts, deals, settings).
 */
async function authed(workspaceId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, session.user.id)
  return session.user.id
}

export async function createAssociation(args: { name: string; slug: string; city?: string; workspaceId: string }) {
  /* Previously: no identity check at all, only an existence check on the
     workspace. That let an anonymous caller enrol an arbitrary workspace into a
     newly created association as its OWNER and inject an attacker-authored NOTE
     into that workspace's activity timeline. */
  const userId = await authed(args.workspaceId)
  const assoc = await db.association.create({ data: { name: args.name, slug: args.slug, city: args.city ?? "Ahmedabad" } })
  await db.associationMember.create({ data: { associationId: assoc.id, workspaceId: args.workspaceId, role: "OWNER" } })
  await db.activity.create({ data: { workspaceId: args.workspaceId, type: "NOTE", body: `Joined association ${assoc.name} as OWNER`, createdBy: userId, source: "system" } })
  return assoc
}

export async function joinAssociation(associationId: string, workspaceId: string) {
  const userId = await authed(workspaceId)
  const existing = await db.associationMember.findUnique({ where: { associationId_workspaceId: { associationId, workspaceId } } })
  if (existing) return existing
  const m = await db.associationMember.create({ data: { associationId, workspaceId } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Joined association ${associationId}`, createdBy: userId, source: "system" } })
  return m
}

export async function poolLead(workspaceId: string, contactId: string, associationId: string) {
  const userId = await authed(workspaceId)
  const contact = await db.contact.findFirst({ where: { id: contactId, workspaceId } })
  if (!contact) throw new Error("Contact not found or not owned by workspace")
  const member = await db.associationMember.findUnique({ where: { associationId_workspaceId: { associationId, workspaceId } } })
  if (!member) throw new Error("Workspace not a member of association")
  const pooled = await db.associationLead.create({ data: { associationId, contactId, pooledByWorkspaceId: workspaceId, status: "POOLED" } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Pooled lead ${contact.firstName} ${contact.lastName} to association`, createdBy: userId, source: "system", contactId } })
  return pooled
}

export async function claimLead(associationLeadId: string, claimerWorkspaceId: string) {
  const userId = await authed(claimerWorkspaceId)
  const lead = await db.associationLead.findUnique({ where: { id: associationLeadId } })
  if (!lead) throw new Error("Pooled lead not found")
  if (lead.status !== "POOLED") throw new Error("Lead already claimed")
  const member = await db.associationMember.findUnique({ where: { associationId_workspaceId: { associationId: lead.associationId, workspaceId: claimerWorkspaceId } } })
  if (!member) throw new Error("Claimer not member of association")
  const claimed = await db.associationLead.update({ where: { id: associationLeadId }, data: { status: "CLAIMED", claimedByWorkspaceId: claimerWorkspaceId } })
  // audit both sides
  await db.activity.create({ data: { workspaceId: claimerWorkspaceId, type: "NOTE", body: `Claimed pooled lead ${lead.contactId}`, createdBy: userId, source: "system", contactId: lead.contactId } })
  await db.activity.create({ data: { workspaceId: lead.pooledByWorkspaceId, type: "NOTE", body: `Pooled lead ${lead.contactId} claimed by ${claimerWorkspaceId}`, createdBy: userId, source: "system", contactId: lead.contactId } })
  return claimed
}

export async function listAssociationInventory(associationId: string, workspaceId: string) {
  await authed(workspaceId)
  const member = await db.associationMember.findUnique({ where: { associationId_workspaceId: { associationId, workspaceId } } })
  if (!member) throw new Error("Not a member")
  return db.associationListing.findMany({ where: { associationId, status: "ACTIVE" }, include: { unit: { include: { project: true } }, listedBy: { select: { id: true, name: true, slug: true } } } })
}

export async function listUnitToAssociation(associationId: string, unitId: string, workspaceId: string) {
  await authed(workspaceId)
  const member = await db.associationMember.findUnique({ where: { associationId_workspaceId: { associationId, workspaceId } } })
  if (!member) throw new Error("Not a member")
  const unit = await db.unit.findFirst({ where: { id: unitId, workspaceId } })
  if (!unit) throw new Error("Unit not owned by workspace")
  return db.associationListing.create({ data: { associationId, unitId, listedByWorkspaceId: workspaceId } })
}

export async function createReferral(args: { associationId: string; fromWorkspaceId: string; toWorkspaceId: string; contactId: string; dealId?: string; pct?: number; amount?: number }) {
  /* Membership of `fromWorkspaceId` is what authorises creating the referral;
     `toWorkspaceId` is the counterparty and only has to be an association
     member, which the check below covers. */
  await authed(args.fromWorkspaceId)
  const fromMember = await db.associationMember.findUnique({ where: { associationId_workspaceId: { associationId: args.associationId, workspaceId: args.fromWorkspaceId } } })
  const toMember = await db.associationMember.findUnique({ where: { associationId_workspaceId: { associationId: args.associationId, workspaceId: args.toWorkspaceId } } })
  if (!fromMember || !toMember) throw new Error("Both workspaces must be association members")
  return db.referral.create({ data: { associationId: args.associationId, fromWorkspaceId: args.fromWorkspaceId, toWorkspaceId: args.toWorkspaceId, contactId: args.contactId, dealId: args.dealId, pct: args.pct, amount: args.amount } })
}
