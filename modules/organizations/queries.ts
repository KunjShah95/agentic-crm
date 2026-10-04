import { db } from "@/lib/db"
import { brokerContactScope, brokerScopeFilter, type ViewerScope } from "@/lib/permissions"

/**
 * Organizations are shared master data — the same company is a counterparty for
 * every broker in the tenant, and an organization exists independently of any
 * deal. So `listOrganizations` is workspace-wide by design: hiding an org from a
 * broker because someone else's deal references it would break the linking
 * workflow the org record exists to support. The `_count` of contacts and deals
 * it returns is a count, not the rows.
 *
 * `getOrganizationDetail` is a different matter — it expands those counts into
 * the actual contact and deal rows, which is where the workspace-wide read turns
 * back into a per-broker leak.
 */
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

export async function getOrganizationDetail(scope: ViewerScope, orgId: string) {
  const org = await db.organization.findFirst({
    where: { id: orgId, workspaceId: scope.workspaceId },
    include: {
      contacts: {
        // Scoped for the same reason the organization itself is not: the org row
        // is shared, but the people and deals hanging off it are not. Left
        // unscoped, this page was a complete directory of every contact and deal
        // on any company a broker happened to look up.
        where: brokerContactScope(scope.role, scope.brokerId),
        orderBy: { firstName: "asc" },
        include: {
          owner: { select: { id: true, name: true } },
          tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
        },
      },
      deals: {
        where: { ...brokerScopeFilter(scope.role, scope.brokerId) },
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
  scope: ViewerScope,
  orgDomain: string | null,
) {
  if (!orgDomain) return []
  return db.contact.findMany({
    where: {
      workspaceId: scope.workspaceId,
      ...brokerContactScope(scope.role, scope.brokerId),
      organizationId: null,
      email: { contains: `@${orgDomain.toLowerCase()}`, mode: "insensitive" },
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    take: 25,
  })
}
