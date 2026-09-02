"use server"

import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"

export async function createAssociation(args: { name: string; slug: string; city?: string; userId: string; workspaceId: string }) {
  const ws = await db.workspace.findUnique({ where: { id: args.workspaceId } })
  if (!ws) throw new Error("Workspace not found")
  const assoc = await db.association.create({ data: { name: args.name, slug: args.slug, city: args.city ?? "Ahmedabad" } })
  await db.associationMember.create({ data: { associationId: assoc.id, workspaceId: args.workspaceId, role: "OWNER" } })
  await db.activity.create({ data: { workspaceId: args.workspaceId, type: "NOTE", body: `Joined association ${assoc.name} as OWNER`, createdBy: args.userId, source: "system" } })
  return assoc
}

export async function joinAssociation(associationId: string, workspaceId: string, userId: string) {
  await requireWorkspaceMember(workspaceId, userId)
  const existing = await db.associationMember.findUnique({ where: { associationId_workspaceId: { associationId, workspaceId } } })
  if (existing) return existing
  const m = await db.associationMember.create({ data: { associationId, workspaceId } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Joined association ${associationId}`, createdBy: userId, source: "system" } })
  return m
}

export async function poolLead(workspaceId: string, contactId: string, associationId: string, userId: string) {
  await requireWorkspaceMember(workspaceId, userId)
  const contact = await db.contact.findFirst({ where: { id: contactId, workspaceId } })
  if (!contact) throw new Error("Contact not found or not owned by workspace")
  const member = await db.associationMember.findUnique({ where: { associationId_workspaceId: { associationId, workspaceId } } })
  if (!member) throw new Error("Workspace not a member of association")
  const pooled = await db.associationLead.create({ data: { associationId, contactId, pooledByWorkspaceId: workspaceId, status: "POOLED" } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Pooled lead ${contact.firstName} ${contact.lastName} to association`, createdBy: userId, source: "system", contactId } })
  return pooled
}

export async function claimLead(associationLeadId: string, claimerWorkspaceId: string, userId: string) {
  await requireWorkspaceMember(claimerWorkspaceId, userId)
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

export async function listAssociationInventory(associationId: string, workspaceId: string, userId: string) {
  await requireWorkspaceMember(workspaceId, userId)
  const member = await db.associationMember.findUnique({ where: { associationId_workspaceId: { associationId, workspaceId } } })
  if (!member) throw new Error("Not a member")
  return db.associationListing.findMany({ where: { associationId, status: "ACTIVE" }, include: { unit: { include: { project: true } }, listedBy: { select: { id: true, name: true, slug: true } } } })
}

export async function listUnitToAssociation(associationId: string, unitId: string, workspaceId: string, userId: string) {
  await requireWorkspaceMember(workspaceId, userId)
  const member = await db.associationMember.findUnique({ where: { associationId_workspaceId: { associationId, workspaceId } } })
  if (!member) throw new Error("Not a member")
  const unit = await db.unit.findFirst({ where: { id: unitId, workspaceId } })
  if (!unit) throw new Error("Unit not owned by workspace")
  return db.associationListing.create({ data: { associationId, unitId, listedByWorkspaceId: workspaceId } })
}

export async function createReferral(args: { associationId: string; fromWorkspaceId: string; toWorkspaceId: string; contactId: string; dealId?: string; pct?: number; amount?: number; userId: string }) {
  await requireWorkspaceMember(args.fromWorkspaceId, args.userId)
  const fromMember = await db.associationMember.findUnique({ where: { associationId_workspaceId: { associationId: args.associationId, workspaceId: args.fromWorkspaceId } } })
  const toMember = await db.associationMember.findUnique({ where: { associationId_workspaceId: { associationId: args.associationId, workspaceId: args.toWorkspaceId } } })
  if (!fromMember || !toMember) throw new Error("Both workspaces must be association members")
  return db.referral.create({ data: { associationId: args.associationId, fromWorkspaceId: args.fromWorkspaceId, toWorkspaceId: args.toWorkspaceId, contactId: args.contactId, dealId: args.dealId, pct: args.pct, amount: args.amount } })
}
