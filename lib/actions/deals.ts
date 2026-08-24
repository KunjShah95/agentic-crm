"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleAction, type Result } from "@/lib/actions"
import { AppError } from "@/lib/errors"
import { canManageData, requireWorkspaceMember } from "@/lib/permissions"
import { dealSchema, pipelineStageSchema, reorderStagesSchema } from "@/lib/validators"

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

export async function createDealAction(
  workspaceId: string,
  input: unknown
): Promise<Result<{ id: string }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    const parsed = dealSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the form.")
    }
    const data = clean(parsed.data as unknown as Record<string, unknown>)

    const stage = await db.pipelineStage.findFirst({
      where: { id: data.stageId as string, workspaceId },
      select: { id: true },
    })
    if (!stage) throw new AppError("NOT_FOUND", "Pick a valid stage.", 404)

    const deal = await db.deal.create({
      data: {
        workspaceId,
        title: data.title as string,
        stageId: data.stageId as string,
        contactId: data.contactId as string | null,
        organizationId: data.organizationId as string | null,
        value: (data.value as number | null) || null,
        currency: (data.currency as string) || "USD",
        probability: data.probability as number | null,
        expectedCloseDate: data.expectedCloseDate as Date | null,
        ownerId: (data.ownerId as string | null) ?? userId,
      },
    })
    return { id: deal.id }
  })
}

export async function updateDealAction(
  workspaceId: string,
  dealId: string,
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    const parsed = dealSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the form.")
    }
    const data = clean(parsed.data as unknown as Record<string, unknown>)

    const deal = await db.deal.findFirst({
      where: { id: dealId, workspaceId },
      select: { id: true },
    })
    if (!deal) throw new AppError("NOT_FOUND", "Deal not found.", 404)

    await db.deal.update({
      where: { id: dealId },
      data: {
        title: data.title as string,
        stageId: data.stageId as string,
        contactId: data.contactId as string | null,
        organizationId: data.organizationId as string | null,
        value: (data.value as number | null) || null,
        currency: (data.currency as string) || "USD",
        probability: data.probability as number | null,
        expectedCloseDate: data.expectedCloseDate as Date | null,
        ownerId: (data.ownerId as string | null) ?? userId,
      },
    })
    return { ok: true }
  })
}

export async function deleteDealAction(
  workspaceId: string,
  dealId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    const membership = await requireWorkspaceMember(workspaceId, userId)
    if (!canManageData(membership.role)) {
      throw new AppError("FORBIDDEN", "Admins and owners can delete deals.", 403)
    }

    const deal = await db.deal.findFirst({
      where: { id: dealId, workspaceId },
      select: { id: true },
    })
    if (!deal) throw new AppError("NOT_FOUND", "Deal not found.", 404)

    await db.deal.delete({ where: { id: dealId } })
    return { ok: true }
  })
}

/**
 * Move a deal between pipeline stages. Stage changes are auto-logged as
 * Activity entries (spec: "Stage changes auto-logged as Activity entries").
 */
export async function moveDealStageAction(
  workspaceId: string,
  dealId: string,
  stageId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    const deal = await db.deal.findFirst({
      where: { id: dealId, workspaceId },
      include: { stage: { select: { id: true, name: true } } },
    })
    if (!deal) throw new AppError("NOT_FOUND", "Deal not found.", 404)

    const target = await db.pipelineStage.findFirst({
      where: { id: stageId, workspaceId },
      select: { id: true, name: true },
    })
    if (!target) throw new AppError("NOT_FOUND", "Stage not found.", 404)

    if (deal.stageId === target.id) return { ok: true }

    await db.$transaction([
      db.deal.update({ where: { id: dealId }, data: { stageId: target.id } }),
      db.activity.create({
        data: {
          workspaceId,
          type: "NOTE",
          dealId,
          body: `Moved deal from "${deal.stage.name}" to "${target.name}"`,
          createdBy: userId,
          source: "manual",
        },
      }),
    ])
    return { ok: true }
  })
}

// ── Pipeline stage management ──────────────────────────────────────────────

export async function createStageAction(
  workspaceId: string,
  input: unknown
): Promise<Result<{ id: string }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    const parsed = pipelineStageSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the stage.")
    }

    const max = await db.pipelineStage.aggregate({
      where: { workspaceId },
      _max: { order: true },
    })

    const stage = await db.pipelineStage.create({
      data: {
        workspaceId,
        name: parsed.data.name,
        color: parsed.data.color,
        order: (max._max.order ?? -1) + 1,
      },
    })
    return { id: stage.id }
  })
}

export async function updateStageAction(
  workspaceId: string,
  stageId: string,
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    const parsed = pipelineStageSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the stage.")
    }

    const stage = await db.pipelineStage.findFirst({
      where: { id: stageId, workspaceId },
      select: { id: true },
    })
    if (!stage) throw new AppError("NOT_FOUND", "Stage not found.", 404)

    await db.pipelineStage.update({
      where: { id: stageId },
      data: { name: parsed.data.name, color: parsed.data.color },
    })
    return { ok: true }
  })
}

export async function deleteStageAction(
  workspaceId: string,
  stageId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    const membership = await requireWorkspaceMember(workspaceId, userId)
    if (!canManageData(membership.role)) {
      throw new AppError("FORBIDDEN", "Admins and owners can delete stages.", 403)
    }

    const stage = await db.pipelineStage.findFirst({
      where: { id: stageId, workspaceId },
      include: { _count: { select: { deals: true } } },
    })
    if (!stage) throw new AppError("NOT_FOUND", "Stage not found.", 404)
    if (stage._count.deals > 0) {
      throw new AppError(
        "STAGE_NOT_EMPTY",
        "Move or delete the deals in this stage before removing it."
      )
    }

    await db.pipelineStage.delete({ where: { id: stageId } })
    return { ok: true }
  })
}

export async function reorderStagesAction(
  workspaceId: string,
  orderedIds: string[]
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    const userId = requireUserId(session?.user?.id)
    await requireWorkspaceMember(workspaceId, userId)

    const parsed = reorderStagesSchema.safeParse({ orderedIds })
    if (!parsed.success) throw new AppError("VALIDATION", "Invalid stage order.")

    const stages = await db.pipelineStage.findMany({
      where: { workspaceId },
      select: { id: true, order: true },
    })
    const ids = new Set(stages.map((s) => s.id))
    if (parsed.data.orderedIds.length !== stages.length || !parsed.data.orderedIds.every((id) => ids.has(id))) {
      throw new AppError("VALIDATION", "Stage list does not match workspace.")
    }

    // Avoid unique (workspaceId, order) collisions by using a high offset in two passes
    const OFFSET = 10_000
    await db.$transaction(async (tx) => {
      for (let i = 0; i < parsed.data.orderedIds.length; i++) {
        await tx.pipelineStage.update({
          where: { id: parsed.data.orderedIds[i] },
          data: { order: OFFSET + i },
        })
      }
      for (let i = 0; i < parsed.data.orderedIds.length; i++) {
        await tx.pipelineStage.update({
          where: { id: parsed.data.orderedIds[i] },
          data: { order: i },
        })
      }
    })
    return { ok: true }
  })
}
