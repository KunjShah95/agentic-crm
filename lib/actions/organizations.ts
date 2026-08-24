"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleAction, type Result } from "@/lib/actions"
import { AppError } from "@/lib/errors"
import { canManageData, requireWorkspaceMember } from "@/lib/permissions"
import { organizationSchema } from "@/lib/validators"
import { emailDomain } from "@/lib/format"

function clean(input: Record<string, unknown>) {
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    data[key] = typeof value === "string" && value.trim() === "" ? null : value
  }
  return data
}

function requireUserId(sessionUserId?: string) {
  if (!sessionUserId) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
  return sessionUserId
}

export async function createOrganizationAction(
  workspaceId: string,
  input: unknown
): Promise<Result<{ id: string }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    const parsed = organizationSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the form.")
    }
    const data = clean(parsed.data as unknown as Record<string, unknown>)

    const org = await db.organization.create({
      data: {
        workspaceId,
        name: data.name as string,
        domain: data.domain as string | null,
        industry: data.industry as string | null,
        size: data.size as string | null,
        website: data.website as string | null,
      },
    })
    return { id: org.id }
  })
}

export async function updateOrganizationAction(
  workspaceId: string,
  orgId: string,
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    const parsed = organizationSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the form.")
    }
    const data = clean(parsed.data as unknown as Record<string, unknown>)

    const org = await db.organization.findFirst({
      where: { id: orgId, workspaceId },
      select: { id: true },
    })
    if (!org) throw new AppError("NOT_FOUND", "Organization not found.", 404)

    await db.organization.update({
      where: { id: orgId },
      data: {
        name: data.name as string,
        domain: data.domain as string | null,
        industry: data.industry as string | null,
        size: data.size as string | null,
        website: data.website as string | null,
      },
    })
    return { ok: true }
  })
}

export async function deleteOrganizationAction(
  workspaceId: string,
  orgId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    const membership = await requireWorkspaceMember(workspaceId, userId)
    if (!canManageData(membership.role)) {
      throw new AppError("FORBIDDEN", "Admins and owners can delete organizations.", 403)
    }

    const org = await db.organization.findFirst({
      where: { id: orgId, workspaceId },
      select: { id: true },
    })
    if (!org) throw new AppError("NOT_FOUND", "Organization not found.", 404)

    await db.organization.delete({ where: { id: orgId } })
    return { ok: true }
  })
}

/**
 * Link a contact to an org. If the org has no domain yet and the contact has
 * an email, infer the domain from it (spec: auto-link suggestion).
 */
export async function linkContactToOrgAction(
  workspaceId: string,
  orgId: string,
  contactId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    const org = await db.organization.findFirst({
      where: { id: orgId, workspaceId },
      select: { id: true, domain: true },
    })
    if (!org) throw new AppError("NOT_FOUND", "Organization not found.", 404)

    const contact = await db.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { id: true, email: true },
    })
    if (!contact) throw new AppError("NOT_FOUND", "Contact not found.", 404)

    await db.$transaction([
      db.contact.update({
        where: { id: contact.id },
        data: { organizationId: org.id },
      }),
      // Infer the domain from the contact's email when missing
      ...(!org.domain && contact.email
        ? [
            db.organization.update({
              where: { id: org.id },
              data: { domain: emailDomain(contact.email) },
            }),
          ]
        : []),
    ])
    return { ok: true }
  })
}

export async function unlinkContactFromOrgAction(
  workspaceId: string,
  contactId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    // Workspace-scoped update — prevents cross-tenant writes
    const result = await db.contact.updateMany({
      where: { id: contactId, workspaceId },
      data: { organizationId: null },
    })
    if (result.count === 0) {
      throw new AppError("NOT_FOUND", "Contact not found.", 404)
    }
    return { ok: true }
  })
}
