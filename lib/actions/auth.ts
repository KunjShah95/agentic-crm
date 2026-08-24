"use server"

import bcrypt from "bcryptjs"
import { AuthError } from "next-auth"

import { handleAction, type Result } from "@/lib/actions"
import { auth, signIn } from "@/lib/auth"
import { db } from "@/lib/db"
import { AppError } from "@/lib/errors"
import { slugify } from "@/lib/format"
import { acceptInviteSchema, loginSchema, signupSchema } from "@/lib/validators"
import type { Role } from "@/lib/generated/prisma/client"

const DEFAULT_STAGES = [
  { name: "Lead", color: "#64748b" },
  { name: "Qualified", color: "#3b82f6" },
  { name: "Proposal", color: "#8b5cf6" },
  { name: "Negotiation", color: "#f59e0b" },
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

export async function loginAction(
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const parsed = loginSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", "Enter a valid email and password.")
    }
    try {
      await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirectTo: "/",
      })
    } catch (err) {
      if (err instanceof AuthError) {
        throw new AppError(
          "INVALID_CREDENTIALS",
          "Invalid email or password.",
          401
        )
      }
      throw err
    }
    return { ok: true }
  })
}

export async function signupAction(
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const parsed = signupSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      throw new AppError("VALIDATION", first?.message ?? "Check your details.")
    }

    const existing = await db.user.findUnique({
      where: { email: parsed.data.email },
    })
    if (existing) {
      throw new AppError(
        "EMAIL_TAKEN",
        "An account with that email already exists. Log in instead."
      )
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12)

    const invite = parsed.data.inviteToken
      ? await db.workspaceInvite.findUnique({
          where: { token: parsed.data.inviteToken },
          include: { workspace: true },
        })
      : null

    let workspaceSlug: string

    if (invite) {
      if (invite.accepted || invite.expiresAt < new Date()) {
        throw new AppError(
          "INVITE_INVALID",
          "This invite is invalid or has expired."
        )
      }
      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: parsed.data.email,
            name: parsed.data.name,
            passwordHash,
          },
        })
        await tx.workspaceMember.create({
          data: {
            workspaceId: invite.workspaceId,
            userId: user.id,
            role: invite.role as Role,
          },
        })
      })
      await db.workspaceInvite.update({
        where: { id: invite.id },
        data: { accepted: true },
      })
      workspaceSlug = invite.workspace.slug
    } else {
      const slug = await uniqueSlug(parsed.data.workspaceName)
      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: parsed.data.email,
            name: parsed.data.name,
            passwordHash,
          },
        })
        const workspace = await tx.workspace.create({
          data: {
            name: parsed.data.workspaceName,
            slug,
            stages: {
              create: DEFAULT_STAGES.map((s, i) => ({ ...s, order: i })),
            },
          },
        })
        await tx.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: user.id,
            role: "OWNER",
          },
        })
      })
      workspaceSlug = slug
    }

    try {
      await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirectTo: `/${workspaceSlug}/contacts`,
      })
    } catch (err) {
      if (err instanceof AuthError) {
        throw new AppError(
          "INVALID_CREDENTIALS",
          "Your account was created — please log in.",
          401
        )
      }
      throw err
    }

    return { ok: true }
  })
}

export async function acceptInviteAction(
  token: string
): Promise<Result<{ redirectTo: string; workspaceId: string }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) {
      throw new AppError("UNAUTHENTICATED", "You need to log in first.", 401)
    }
    const parsed = acceptInviteSchema.safeParse({ token })
    if (!parsed.success) throw new AppError("VALIDATION", "Invalid invite link.")

    const invite = await db.workspaceInvite.findUnique({
      where: { token: parsed.data.token },
      include: { workspace: { select: { slug: true, name: true } } },
    })
    if (!invite || invite.accepted || invite.expiresAt < new Date()) {
      throw new AppError(
        "INVITE_INVALID",
        "This invite is invalid or has expired."
      )
    }

    await db.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: session.user.id,
        },
      },
      create: {
        workspaceId: invite.workspaceId,
        userId: session.user.id,
        role: invite.role as Role,
      },
      update: {},
    })
    await db.workspaceInvite.update({
      where: { id: invite.id },
      data: { accepted: true },
    })

    return {
      redirectTo: `/${invite.workspace.slug}/contacts`,
      workspaceId: invite.workspaceId,
    }
  })
}
