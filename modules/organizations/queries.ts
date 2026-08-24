import { db } from "@/lib/db"

export async function listOrganizations(workspaceId: string, q?: string) {
  const where = {
    workspaceId,
    ...(q?.trim()
      ? { name: { contains: q.trim(), mode: "insensitive" as const } }
      : {}),
  }

  const [items, total] = await Promise.all([
    db.organization.findMany({
      where,
      include: {
        _count: { select: { contacts: true, deals: true } },
      },
      orderBy: { name: "asc" },
      take: 100,
    }),
    db.organization.count({ where }),
  ])
  return { items, total }
}

export async function getOrganizationDetail(workspaceId: string, orgId: string) {
  const org = await db.organization.findFirst({
    where: { id: orgId, workspaceId },
    include: {
      contacts: {
        orderBy: { firstName: "asc" },
        include: {
          owner: { select: { id: true, name: true } },
          tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
        },
      },
      deals: {
        orderBy: { updatedAt: "desc" },
        include: {
          stage: { select: { id: true, name: true, color: true } },
          owner: { select: { id: true, name: true } },
        },
      },
    },
  })
  return org
}

/**
 * Contacts whose email domain matches the org's domain but that aren't linked
 * yet — the spec's "auto-link suggestion" prompt.
 */
export async function getLinkableContacts(
  workspaceId: string,
  orgDomain: string | null
) {
  if (!orgDomain) return []
  return db.contact.findMany({
    where: {
      workspaceId,
      organizationId: null,
      email: { contains: `@${orgDomain.toLowerCase()}`, mode: "insensitive" },
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    take: 25,
  })
}
