"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleAction, type Result } from "@/lib/actions"
import { AppError } from "@/lib/errors"
import { canManageData, requireWorkspaceMember } from "@/lib/permissions"
import {
  bulkAssignSchema,
  bulkTagSchema,
  contactSchema,
} from "@/lib/validators"
import { listContacts, type ContactFilters } from "@/modules/contacts/queries"
import { requireQuota } from "@/modules/billing/quota"

function clean(input: Record<string, unknown>) {
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    data[key] = typeof value === "string" && value.trim() === "" ? null : value
  }
  return data
}

export async function createContactAction(
  workspaceId: string,
  input: unknown
): Promise<Result<{ id: string }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const parsed = contactSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the form.")
    }
    const data = clean(parsed.data as unknown as Record<string, unknown>)
    await requireQuota(workspaceId, "contacts")
    const contact = await db.contact.create({
      data: {
        workspaceId,
        firstName: data.firstName as string,
        lastName: (data.lastName as string) ?? "",
        email: data.email as string | null,
        phone: data.phone as string | null,
        linkedinUrl: data.linkedinUrl as string | null,
        jobTitle: data.jobTitle as string | null,
        organizationId: data.organizationId as string | null,
        ownerId: session.user.id,
        createdBy: session.user.id,
      },
    })
    return { id: contact.id }
  })
}

export async function updateContactAction(
  workspaceId: string,
  contactId: string,
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const parsed = contactSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the form.")
    }
    const data = clean(parsed.data as unknown as Record<string, unknown>)

    const exists = await db.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { id: true },
    })
    if (!exists) throw new AppError("NOT_FOUND", "Contact not found.", 404)

    await db.contact.update({
      where: { id: contactId },
      data: {
        firstName: data.firstName as string,
        lastName: (data.lastName as string) ?? "",
        email: data.email as string | null,
        phone: data.phone as string | null,
        linkedinUrl: data.linkedinUrl as string | null,
        jobTitle: data.jobTitle as string | null,
        organizationId: data.organizationId as string | null,
      },
    })
    return { ok: true }
  })
}

export async function setContactOwnerAction(
  workspaceId: string,
  contactId: string,
  ownerId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const exists = await db.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { id: true },
    })
    if (!exists) throw new AppError("NOT_FOUND", "Contact not found.", 404)

    await db.contact.update({ where: { id: contactId }, data: { ownerId: ownerId || null } })
    return { ok: true }
  })
}

export async function deleteContactAction(
  workspaceId: string,
  contactId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    const membership = await requireWorkspaceMember(workspaceId, session.user.id)
    if (!canManageData(membership.role)) {
      throw new AppError("FORBIDDEN", "Admins and owners can delete contacts.", 403)
    }

    const exists = await db.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { id: true },
    })
    if (!exists) throw new AppError("NOT_FOUND", "Contact not found.", 404)

    await db.contact.delete({ where: { id: contactId } })
    return { ok: true }
  })
}

export async function bulkTagContactsAction(
  workspaceId: string,
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const parsed = bulkTagSchema.safeParse(input)
    if (!parsed.success) throw new AppError("VALIDATION", "Select contacts and tags.")

    await db.contactTag.createMany({
      data: parsed.data.contactIds.flatMap((contactId) =>
        parsed.data.tagIds.map((tagId) => ({ contactId, tagId }))
      ),
      skipDuplicates: true,
    })
    return { ok: true }
  })
}

export async function bulkAssignContactsAction(
  workspaceId: string,
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const parsed = bulkAssignSchema.safeParse(input)
    if (!parsed.success) throw new AppError("VALIDATION", "Select contacts and an owner.")

    await db.contact.updateMany({
      where: { id: { in: parsed.data.contactIds }, workspaceId },
      data: { ownerId: parsed.data.ownerId },
    })
    return { ok: true }
  })
}

export async function exportContactsCsvAction(
  workspaceId: string,
  filters: ContactFilters & { ids?: string[] }
): Promise<Result<{ filename: string; content: string }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const { items } = await listContacts(workspaceId, {
      ...filters,
      pageSize: 1000,
      page: 1,
      ids: filters.ids,
    })

    const escape = (value: string | null | undefined) => {
      let v = value ?? ""
      // CSV formula injection guard: neutralize cells starting with = + - @
      if (/^[=+\-@]/.test(v)) v = `'${v}`
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
    }
    const header = ["First Name", "Last Name", "Email", "Phone", "Job Title", "Company", "LinkedIn", "Owner ID"]
    const rows = items.map((c) =>
      [
        c.firstName,
        c.lastName,
        c.email,
        c.phone,
        c.jobTitle,
        c.organization?.name,
        c.linkedinUrl,
        c.ownerId,
      ]
        .map(escape)
        .join(",")
    )

    return {
      filename: `contacts-${new Date().toISOString().slice(0, 10)}.csv`,
      content: [header.join(","), ...rows].join("\n"),
    }
  })
}
