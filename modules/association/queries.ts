import { db } from "@/lib/db"

export async function listAssociationMembers(associationId: string) {
  return db.associationMember.findMany({ where: { associationId }, include: { workspace: { select: { id: true, name: true, slug: true } } } })
}

export async function listPooledLeads(associationId: string, status: string = "POOLED") {
  return db.associationLead.findMany({
    where: { associationId, status },
    include: { contact: { select: { id: true, firstName: true, lastName: true, leadSource: true, phone: true } }, pooledBy: { select: { id: true, name: true, slug: true } }, claimedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })
}

export async function listReferrals(associationId: string) {
  return db.referral.findMany({ where: { associationId }, include: { contact: { select: { id: true, firstName: true, lastName: true } }, fromWorkspace: { select: { name: true } }, toWorkspace: { select: { name: true } } }, orderBy: { createdAt: "desc" } })
}

export async function getAssociationForWorkspace(workspaceId: string) {
  const member = await db.associationMember.findFirst({ where: { workspaceId }, include: { association: true } })
  return member?.association ?? null
}
