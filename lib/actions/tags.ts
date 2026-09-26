"use server"

import { z } from "zod"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleAction, type Result } from "@/lib/actions"
import { AppError } from "@/lib/errors"
import { requireWorkspaceMember } from "@/lib/permissions"

const tagSchema = z.object({
  name: z.string().trim().min(1, "Tag name is required").max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a color")
    .default("#64748b"),
})

function requireUserId(sessionUserId?: string) {
  if (!sessionUserId) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
  return sessionUserId
}

/** Verify a tag belongs to the workspace. */
async function requireWorkspaceTag(workspaceId: string, tagId: string) {
  const tag = await db.tag.findFirst({
    where: { id: tagId, workspaceId },
    select: { id: true },
  })
  if (!tag) throw new AppError("NOT_FOUND", "Tag not found.", 404)
}

/** Verify a contact belongs to the workspace. */
async function requireWorkspaceContact(workspaceId: string, contactId: string) {
  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId },
    select: { id: true },
  })
  if (!contact) throw new AppError("NOT_FOUND", "Contact not found.", 404)
}

/** Verify a deal belongs to the workspace. */
async function requireWorkspaceDeal(workspaceId: string, dealId: string) {
  const deal = await db.deal.findFirst({
    where: { id: dealId, workspaceId },
    select: { id: true },
  })
  if (!deal) throw new AppError("NOT_FOUND", "Deal not found.", 404)
}

export async function createTagAction(
  workspaceId: string,
  input: unknown
): Promise<Result<{ id: string }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    const parsed = tagSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the tag.")
    }

    const existing = await db.tag.findFirst({
      where: { workspaceId, name: parsed.data.name },
      select: { id: true },
    })
    if (existing) return { id: existing.id }

    const tag = await db.tag.create({
      data: { workspaceId, name: parsed.data.name, color: parsed.data.color },
    })
    return { id: tag.id }
  })
}

export async function assignContactTagAction(
  workspaceId: string,
  contactId: string,
  tagId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    await Promise.all([
      requireWorkspaceContact(workspaceId, contactId),
      requireWorkspaceTag(workspaceId, tagId),
    ])

    await db.contactTag.create({ data: { contactId, tagId } }).catch(() => {
      // duplicate — fine
    })
    return { ok: true }
  })
}

export async function removeContactTagAction(
  workspaceId: string,
  contactId: string,
  tagId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    await Promise.all([
      requireWorkspaceContact(workspaceId, contactId),
      requireWorkspaceTag(workspaceId, tagId),
    ])

    await db.contactTag.delete({
      where: { contactId_tagId: { contactId, tagId } },
    })
    return { ok: true }
  })
}

export async function assignDealTagAction(
  workspaceId: string,
  dealId: string,
  tagId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    await Promise.all([
      requireWorkspaceDeal(workspaceId, dealId),
      requireWorkspaceTag(workspaceId, tagId),
    ])

    await db.dealTag.create({ data: { dealId, tagId } }).catch(() => {
      // duplicate — fine
    })
    return { ok: true }
  })
}

export async function removeDealTagAction(
  workspaceId: string,
  dealId: string,
  tagId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    await Promise.all([
      requireWorkspaceDeal(workspaceId, dealId),
      requireWorkspaceTag(workspaceId, tagId),
    ])

    await db.dealTag.delete({
      where: { dealId_tagId: { dealId, tagId } },
    })
    return { ok: true }
  })
}

export async function updateTagAction(
  workspaceId: string,
  tagId: string,
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    await requireWorkspaceTag(workspaceId, tagId)

    const parsed = tagSchema.partial().safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the tag.")
    }

    const data: { name?: string; color?: string } = {}
    if (parsed.data.name !== undefined) data.name = parsed.data.name
    if (parsed.data.color !== undefined) data.color = parsed.data.color

    if (data.name) {
      const existing = await db.tag.findFirst({
        where: { workspaceId, name: data.name, id: { not: tagId } },
        select: { id: true },
      })
      if (existing) throw new AppError("VALIDATION", "A tag with that name already exists.")
    }

    await db.tag.update({ where: { id: tagId }, data })
    return { ok: true }
  })
}

export async function deleteTagAction(
  workspaceId: string,
  tagId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    await requireWorkspaceTag(workspaceId, tagId)

    // Remove all associations first
    await db.$transaction([
      db.contactTag.deleteMany({ where: { tagId } }),
      db.dealTag.deleteMany({ where: { tagId } }),
      db.tag.delete({ where: { id: tagId } }),
    ])
    return { ok: true }
  })
}

export async function listTagsAction(
  workspaceId: string
): Promise<Result<{ id: string; name: string; color: string; _count: { contacts: number; deals: number } }[]>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    const tags = await db.tag.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        _count: { select: { contacts: true, deals: true } },
      },
    })
    return tags
  })
}
