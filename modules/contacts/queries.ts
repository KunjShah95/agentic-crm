import { db } from "@/lib/db"
import { Prisma } from "@/lib/generated/prisma/client"

export type ContactFilters = {
  q?: string
  tagId?: string
  organizationId?: string
  ownerId?: string
  sort?: "newest" | "oldest" | "name" | "updated"
  page?: number
  pageSize?: number
  ids?: string[]
}

const SORTS = {
  newest: { createdAt: "desc" as const },
  oldest: { createdAt: "asc" as const },
  name: { firstName: "asc" as const },
  updated: { updatedAt: "desc" as const },
}

export async function listContacts(workspaceId: string, filters: ContactFilters = {}) {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25))

  const where: Prisma.ContactWhereInput = { workspaceId }

  if (filters.q) {
    const q = filters.q.trim()
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { jobTitle: { contains: q, mode: "insensitive" } },
    ]
  }
  if (filters.tagId) where.tags = { some: { tagId: filters.tagId } }
  if (filters.organizationId) where.organizationId = filters.organizationId
  if (filters.ownerId) where.ownerId = filters.ownerId
  if (filters.ids?.length) where.id = { in: filters.ids }

  const orderBy = SORTS[filters.sort ?? "newest"]

  const [items, total] = await Promise.all([
    db.contact.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, domain: true } },
        owner: { select: { id: true, name: true } },
        tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.contact.count({ where }),
  ])

  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getContactDetail(workspaceId: string, contactId: string) {
  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId },
    include: {
      organization: { select: { id: true, name: true, domain: true, industry: true } },
      owner: { select: { id: true, name: true } },
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      deals: {
        include: { stage: { select: { id: true, name: true, color: true } } },
        orderBy: { updatedAt: "desc" },
      },
      activities: {
        include: { deal: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })
  return contact
}

export async function listWorkspaceMembers(workspaceId: string) {
  return db.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { role: "asc" },
  })
}

// ── Social identity helpers (handles JSON) ──────────────────────────────────

/**
 * Find contact by social handle stored in Contact.handles JSON.
 * Shape: { [provider]: handle } e.g. { x: "@ada", whatsapp: "+1555..." }
 * Uses Prisma JSON path query with fallback to JS filtering for test/mock compat.
 */
export async function findContactByHandle(
  workspaceId: string,
  provider: string,
  handle: string
) {
  const normalizedProvider = provider.toLowerCase().trim()
  const normalizedHandle = handle.trim()
  if (!normalizedHandle) return null

  // Primary: JSON path query (Postgres JSONB)
  try {
    const found = await db.contact.findFirst({
      where: {
        workspaceId,
        handles: { path: [normalizedProvider], equals: normalizedHandle },
      } as unknown as Prisma.ContactWhereInput,
      select: { id: true, handles: true, firstName: true, lastName: true },
    })
    if (found) return found
  } catch {
    // fall through
  }

  // Fallback: scan workspace contacts and match in JS (for mocks / unsupported adapters)
  const candidates = await db.contact.findMany({
    where: { workspaceId },
    select: { id: true, handles: true, firstName: true, lastName: true, phone: true },
  })
  for (const c of candidates) {
    const h = c.handles as Record<string, unknown> | null
    if (h && typeof h === "object" && h[normalizedProvider] === normalizedHandle) return c
    if (h && typeof h === "object" && Object.values(h).includes(normalizedHandle)) return c
    // WhatsApp phone fallback
    if (normalizedProvider === "whatsapp" && (c as unknown as { phone?: string }).phone === normalizedHandle) {
      return c
    }
  }
  return null
}

/**
 * Get contacts linkable via handles — thin wrapper used by social-ingest identity resolve.
 */
export async function getContactsByHandle(
  workspaceId: string,
  handles: Record<string, string>
) {
  const results: Awaited<ReturnType<typeof findContactByHandle>>[] = []
  for (const [provider, handle] of Object.entries(handles)) {
    const c = await findContactByHandle(workspaceId, provider, handle)
    if (c) results.push(c)
  }
  return results
}
