"use server"

import crypto from "crypto"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleAction, type Result } from "@/lib/actions"
import { AppError } from "@/lib/errors"
import { requireWorkspaceMember } from "@/lib/permissions"
import { getProvider } from "@/modules/social/provider"

export async function getSocialAuthUrlAction(
  workspaceId: string,
  provider: string
): Promise<Result<{ url: string }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)
    const p = getProvider(provider)
    // state encodes workspaceId + random nonce for CSRF; worker/social callback can verify
    const state = Buffer.from(
      JSON.stringify({ workspaceId, provider: p.name, nonce: crypto.randomBytes(8).toString("hex") })
    ).toString("base64url")
    const url = await p.getAuthUrl(state)
    return { url }
  })
}

export async function disconnectSocialAction(
  workspaceId: string,
  connectionId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)
    const conn = await db.socialConnection.findFirst({
      where: { id: connectionId, workspaceId },
    })
    if (!conn) throw new AppError("NOT_FOUND", "Connection not found.", 404)
    await db.socialConnection.delete({ where: { id: connectionId } })
    return { ok: true }
  })
}
