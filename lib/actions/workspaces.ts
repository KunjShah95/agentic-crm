"use server"

import { handleAction, type Result } from "@/lib/actions"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { AppError } from "@/lib/errors"
import { slugify } from "@/lib/format"

const DEFAULT_STAGES = [
  { name: "Enquiry", color: "#64748b" },
  { name: "Site Visit", color: "#3b82f6" },
  { name: "Hold", color: "#8b5cf6" },
  { name: "Booking", color: "#f59e0b" },
  { name: "Won", color: "#10b981" },
  { name: "Lost", color: "#ef4444" },
]

async function uniqueSlug(base: string) {
  const slug = slugify(base) || "workspace"
  let candidate = slug
  let i = 2
  while (await db.workspace.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${i++}`
  }
  return candidate
}

/**
 * Create a new workspace for the signed-in user and make them its OWNER.
 * Used by the sidebar workspace switcher ("Create workspace").
 */
export async function createWorkspaceAction(
  name: string
): Promise<Result<{ id: string; slug: string }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) {
      throw new AppError("UNAUTHENTICATED", "You need to log in first.", 401)
    }

    const trimmed = name.trim()
    if (trimmed.length < 2) {
      throw new AppError("VALIDATION", "Workspace name must be at least 2 characters.")
    }

    const slug = await uniqueSlug(trimmed)
    const workspace = await db.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: trimmed,
          slug,
          stages: { create: DEFAULT_STAGES.map((s, i) => ({ ...s, order: i })) },
        },
      })
      await tx.workspaceMember.create({
        data: { workspaceId: ws.id, userId: session.user!.id, role: "OWNER" },
      })
      return ws
    })

    return { id: workspace.id, slug: workspace.slug }
  })
}
