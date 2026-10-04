import { db } from "@/lib/db"
import { PermissionError } from "@/lib/errors"
import type { Prisma, Role } from "@/lib/generated/prisma/client"

// SALES/BROKER/VIEWER sit at the MEMBER baseline for min-role gates; broker
// visibility is narrowed separately via brokerScopeFilter, not by rank.
const ROLE_RANK: Record<Role, number> = { VIEWER: 0, BROKER: 0, MEMBER: 0, SALES: 0, ADMIN: 1, OWNER: 2 }

export function hasMinRole(role: Role, minRole?: Role) {
  if (!minRole) return true
  return ROLE_RANK[role] >= ROLE_RANK[minRole]
}

/** Roles that can invite members (spec matrix: ADMIN + OWNER). */
export function canInvite(role: Role) {
  return role === "ADMIN" || role === "OWNER"
}

/** Roles that can delete workspace data (spec matrix: ADMIN + OWNER). */
export function canManageData(role: Role) {
  return role === "ADMIN" || role === "OWNER"
}

/** Only the owner can delete the workspace / touch billing. */
export function isOwner(role: Role) {
  return role === "OWNER"
}

/** Roles that can manage billing (Stripe portal/checkout). OWNER + ADMIN. */
export function canManageBilling(role: Role) {
  return role === "OWNER" || role === "ADMIN"
}

/*
 * No `canManageInventory` / `canViewInventory` here. Both were defined and never
 * called, and they were the only two members of this group that did not gate
 * anything — `canViewInventory` returned `true` for every role while sitting
 * beside four helpers that actually check one, which is exactly the shape that
 * gets adopted in a hurry and ships as a leak.
 *
 * What actually authorises inventory today is `requireWorkspaceMember` with no
 * `minRole`, i.e. any member of the workspace may write units and cost sheets.
 * If that is wrong, the fix is to pass `"ADMIN"` at those call sites rather than
 * to reintroduce a role predicate that nothing reads.
 */

export type Membership = {
  role: Role
  workspaceId: string
  workspace: { slug: string; name: string }
}

/**
 * The single gate every server action and API route calls before touching
 * data. Throws PermissionError (→ 403) when the user is not a member or
 * lacks the minimum role. Never silently succeeds.
 */
export async function requireWorkspaceMember(
  workspaceId: string,
  userId: string,
  minRole?: Role
): Promise<Membership> {
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: { select: { slug: true, name: true } } },
  })

  if (!membership) {
    throw new PermissionError("You're not a member of this workspace.")
  }
  if (minRole && !hasMinRole(membership.role, minRole)) {
    throw new PermissionError(
      `This action requires the ${minRole} role (you're a ${membership.role}).`
    )
  }
  return membership
}

/**
 * Row-level visibility filter for Brokers. BROKER-role users see only the
 * inventory/deals allocated to their own broker record; every other role sees
 * all workspace rows. Spread into a Prisma `where` alongside the workspaceId filter.
 */
export function brokerScopeFilter(role: Role, brokerId?: string | null): { brokerId?: string } {
  if (role === "BROKER") {
    // A broker with no linked brokerId can see nothing — force an unmatchable filter.
    return { brokerId: brokerId ?? "__no_broker__" }
  }
  return {}
}

/**
 * Broker visibility for `Contact` rows.
 *
 * `Contact` has no `brokerId` column, so `brokerScopeFilter` — which returns
 * `{ brokerId }` — cannot be spread into a `ContactWhereInput`. Contacts reach a
 * broker through their deals instead: a contact is broker-visible when at least
 * one of its deals carries that brokerId. Same fail-closed contract as
 * `brokerScopeFilter`: a BROKER with no linked broker record matches nothing.
 *
 * ── Settled product decision; implementation pending ─────────────────────────
 * The deal-attachment rule below makes a contact invisible to a broker until it
 * is attached to one of their deals, so a freshly imported or reassigned lead —
 * not yet on a deal — does not appear on `/contacts`.
 *
 * That was the secure reading of "a broker sees only their allocated book", and
 * it was an open question rather than a settled rule. It is now settled, and the
 * other way: brokers are expected to work a raw lead list, so broker visibility
 * follows ownership:
 *
 *     return role === "BROKER" ? { ownerId: userId } : {}
 *
 * `ViewerScope` already carries `workspaceId`, `role` and `brokerId`, so it
 * needs a `userId` to express that. Until it does, this function still applies
 * the deal-attachment rule and the gap is real: an imported lead is off the
 * broker's `/contacts` until it lands on a deal.
 *
 * Changing it is not only a where-clause edit. `getContactDetail` scopes the
 * nested `deals` relation as well as the parent row, and `broker-scope-registry`
 * asserts that entries claiming `"scoped"` really call a filter helper, so the
 * registry entry and both suites have to move with it. Tracked in
 * `docs/security/open-findings.md`.
 */
export function brokerContactScope(
  role: Role,
  brokerId?: string | null,
): Prisma.ContactWhereInput {
  if (role !== "BROKER") return {}
  return { deals: { some: { brokerId: brokerId ?? "__no_broker__" } } }
}

/**
 * The identity every tenant-scoped read path is given.
 *
 * Requiring this object — rather than a bare `workspaceId: string` — is what
 * makes broker scoping impossible to omit by accident. `brokerScopeFilter`
 * needs a role to do anything, so a signature that carries only a workspace id
 * has no way to scope and silently returns `{}`, which reads as "everyone sees
 * everything" and is correct for an ADMIN while being a full tenant-internal
 * data leak for a BROKER.
 *
 * Build it with `resolveViewerScope` rather than by hand at each call site:
 * forgetting `brokerId` is the exact failure mode this type exists to prevent,
 * and it is invisible in review because an absent brokerId is a valid value.
 */
export type ViewerScope = {
  workspaceId: string
  role: Role
  brokerId?: string | null
}

/**
 * Resolve the caller's role and linked broker id in one place.
 *
 * Returns `null` when the user is not a member of the workspace, so callers can
 * `notFound()` exactly as they did when they inlined the membership lookup.
 * Membership is read here and nowhere else in the read path, which is what lets
 * `resolveViewerScope` be the single answer to "what may this caller see".
 */
export async function resolveViewerScope(
  workspaceId: string,
  userId: string,
): Promise<ViewerScope | null> {
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  })
  if (!membership) return null

  // Only BROKER needs the extra lookup. Resolving it for every role would add a
  // query to every page render to serve a filter that is a no-op for everyone
  // else.
  if (membership.role !== "BROKER") {
    return { workspaceId, role: membership.role, brokerId: null }
  }

  const broker = await db.broker.findFirst({
    where: { workspaceId, userId },
    select: { id: true },
  })
  return { workspaceId, role: membership.role, brokerId: broker?.id ?? null }
}
