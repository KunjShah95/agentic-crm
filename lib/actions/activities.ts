"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleAction, type Result } from "@/lib/actions"
import { AppError } from "@/lib/errors"
import { requireWorkspaceMember } from "@/lib/permissions"
import { activitySchema, completeTaskSchema } from "@/lib/validators"
import type { ActivityType } from "@/lib/generated/prisma/client"

export const ACTIVITY_SOURCES = ["manual", "social", "agent"] as const
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number]

export async function createActivityAction(
  workspaceId: string,
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const parsed = activitySchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the form.")
    }

    const { type, contactId, dealId, body, scheduledAt, assigneeId } = parsed.data

    if (contactId) {
      const contact = await db.contact.findFirst({
        where: { id: contactId, workspaceId },
        select: { id: true },
      })
      if (!contact) throw new AppError("NOT_FOUND", "Contact not found.", 404)
    }
    if (dealId) {
      const deal = await db.deal.findFirst({
        where: { id: dealId, workspaceId },
        select: { id: true },
      })
      if (!deal) throw new AppError("NOT_FOUND", "Deal not found.", 404)
    }

    const isTask = type === "TASK"
    // Validate assignee is a workspace member when provided; default to creator
    let taskAssigneeId: string | null = null
    if (isTask) {
      const rawAssignee = (assigneeId as string | undefined)?.trim() || null
      if (rawAssignee) {
        const member = await db.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: rawAssignee } },
          select: { userId: true },
        })
        if (!member) throw new AppError("NOT_FOUND", "Assignee is not a workspace member.", 404)
        taskAssigneeId = rawAssignee
      } else {
        taskAssigneeId = session.user.id
      }
    }
    await db.activity.create({
      data: {
        workspaceId,
        type: type as ActivityType,
        contactId: contactId || null,
        dealId: dealId || null,
        body: body?.trim() || null,
        scheduledAt: isTask ? scheduledAt ?? null : null,
        assigneeId: isTask ? taskAssigneeId : null,
        createdBy: session.user.id,
        source: "manual",
      },
    })
    return { ok: true }
  })
}

/**
 * Query activities by source — used by social timeline filters.
 * Social activities have source='social' and socialEventId set (via worker/social-ingest).
 */
export async function listActivitiesBySource(
  workspaceId: string,
  userId: string,
  source: ActivitySource = "manual"
) {
  await requireWorkspaceMember(workspaceId, userId)
  return db.activity.findMany({
    where: { workspaceId, source },
    orderBy: { createdAt: "desc" },
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
  })
}

export async function getActivityBySocialEvent(workspaceId: string, socialEventId: string) {
  return db.activity.findFirst({
    where: { workspaceId, socialEventId },
    include: { contact: true, socialEvent: true },
  })
}

export async function completeTaskAction(
  workspaceId: string,
  activityId: string,
  completed: boolean
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const parsed = completeTaskSchema.safeParse({ activityId, completed })
    if (!parsed.success) throw new AppError("VALIDATION", "Invalid task.")

    const task = await db.activity.findFirst({
      where: { id: parsed.data.activityId, workspaceId, type: "TASK" },
      select: { id: true },
    })
    if (!task) throw new AppError("NOT_FOUND", "Task not found.", 404)

    await db.activity.update({
      where: { id: task.id },
      data: { completedAt: parsed.data.completed ? new Date() : null },
    })
    return { ok: true }
  })
}
