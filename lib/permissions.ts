import { db } from "@/lib/db"
import { PermissionError } from "@/lib/errors"
import type { Role } from "@/lib/generated/prisma/client"

const ROLE_RANK: Record<Role, number> = { MEMBER: 0, ADMIN: 1, OWNER: 2 }

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

export function canManageInventory(role: Role) {
  return role === "OWNER" || role === "ADMIN"
}
export function canViewInventory(role: Role) {
  return true
}

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
