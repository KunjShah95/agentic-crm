"use server"

import { randomBytes } from "crypto"
import { addDays } from "date-fns"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleAction, type Result } from "@/lib/actions"
import { AppError } from "@/lib/errors"
import { canInvite, hasMinRole, isOwner, requireWorkspaceMember } from "@/lib/permissions"
import { inviteSchema, updateRoleSchema, workspaceSchema } from "@/lib/validators"
import { requireQuota } from "@/modules/billing/quota"

function requireUserId(sessionUserId?: string) {
  if (!sessionUserId) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
  return sessionUserId
}

export async function updateWorkspaceSettingsAction(
  workspaceId: string,
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    const membership = await requireWorkspaceMember(workspaceId, userId, "ADMIN")

    const parsed = workspaceSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the form.")
    }

    const slug = parsed.data.slug
    if (slug !== membership.workspace.slug) {
      const taken = await db.workspace.findUnique({ where: { slug } })
      if (taken && taken.id !== workspaceId) {
        throw new AppError("SLUG_TAKEN", "That slug is already in use.")
      }
    }

    await db.workspace.update({
      where: { id: workspaceId },
      data: { name: parsed.data.name, slug },
    })
    return { ok: true }
  })
}

export async function deleteWorkspaceAction(
  workspaceId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    const membership = await requireWorkspaceMember(workspaceId, userId)
    if (!isOwner(membership.role)) {
      throw new AppError("FORBIDDEN", "Only the workspace owner can delete it.", 403)
    }

    await db.workspace.delete({ where: { id: workspaceId } })
    return { ok: true }
  })
}

export async function inviteMemberAction(
  workspaceId: string,
  input: unknown
): Promise<Result<{ token: string }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    const membership = await requireWorkspaceMember(workspaceId, userId)
    if (!canInvite(membership.role)) {
      throw new AppError("FORBIDDEN", "Admins and owners can invite members.", 403)
    }

    const parsed = inviteSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the email.")
    }

    const existing = await db.workspaceMember.findFirst({
      where: { workspaceId, user: { email: parsed.data.email } },
      select: { userId: true },
    })
    if (existing) {
      throw new AppError(
        "ALREADY_MEMBER",
        `${parsed.data.email} is already a member of this workspace.`
      )
    }

    await requireQuota(workspaceId, "seats")

    const token = randomBytes(24).toString("hex")
    await db.workspaceInvite.create({
      data: {
        workspaceId,
        email: parsed.data.email,
        role: parsed.data.role,
        token,
        expiresAt: addDays(new Date(), 7),
      },
    })
    return { token }
  })
}

export async function cancelInviteAction(
  workspaceId: string,
  inviteId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    const membership = await requireWorkspaceMember(workspaceId, userId)
    if (!canInvite(membership.role)) {
      throw new AppError("FORBIDDEN", "Admins and owners can manage invites.", 403)
    }

    await db.workspaceInvite.delete({
      where: { id: inviteId, workspaceId },
    })
    return { ok: true }
  })
}

export async function updateMemberRoleAction(
  workspaceId: string,
  userId: string,
  role: "ADMIN" | "MEMBER"
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const actorId = requireUserId(session?.user?.id)
    const membership = await requireWorkspaceMember(workspaceId, actorId)
    if (!hasMinRole(membership.role, "ADMIN")) {
      throw new AppError("FORBIDDEN", "Admins and owners can change roles.", 403)
    }

    const parsed = updateRoleSchema.safeParse({ userId, role })
    if (!parsed.success) throw new AppError("VALIDATION", "Invalid role.")

    const target = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { user: { select: { name: true } } },
    })
    if (!target) throw new AppError("NOT_FOUND", "Member not found.", 404)
    if (target.role === "OWNER") {
      throw new AppError("FORBIDDEN", "The workspace owner's role can't be changed.", 403)
    }

    await db.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: { role: parsed.data.role },
    })
    return { ok: true }
  })
}

export async function removeMemberAction(
  workspaceId: string,
  userId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const actorId = requireUserId(session?.user?.id)
    const membership = await requireWorkspaceMember(workspaceId, actorId)
    if (!hasMinRole(membership.role, "ADMIN")) {
      throw new AppError("FORBIDDEN", "Admins and owners can remove members.", 403)
    }
    if (userId === actorId) {
      throw new AppError("FORBIDDEN", "You can't remove yourself.", 403)
    }

    const target = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    })
    if (!target) throw new AppError("NOT_FOUND", "Member not found.", 404)
    if (target.role === "OWNER") {
      throw new AppError("FORBIDDEN", "The workspace owner can't be removed.", 403)
    }

    await db.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    })
    return { ok: true }
  })
}
