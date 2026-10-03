"use server"

/**
 * Server actions for the lead-ingest configuration: minting the shared secret
 * that authenticates server-to-server lead webhooks, and turning the WhatsApp
 * auto-ack on or off.
 *
 * These exist because the controls in `./ingress` are unusable without a way to
 * configure them. Until an owner can mint a secret from the app, onboarding a
 * customer means editing `Workspace.settingsJson` by hand — which is exactly
 * how a security control quietly stops being used.
 *
 * ADMIN+ for all three: these control who can write into the workspace from
 * outside it. A MEMBER who can create contacts should not be able to mint a
 * credential.
 */

import { auth } from "@/lib/auth"
import { handleAction, type Result } from "@/lib/actions"
import { AppError } from "@/lib/errors"
import { requireWorkspaceMember } from "@/lib/permissions"
import {
  createIngestSecret,
  getLeadIngestSettings,
  revokeIngestSecret,
  setAutoAck,
} from "./ingress"

export type IngestStatus = {
  /** Whether a shared secret is stored. The secret itself is never returned. */
  configured: boolean
  autoAck: boolean
  updatedAt?: string
}

export async function getIngestStatusAction(workspaceId: string): Promise<Result<IngestStatus>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const settings = await getLeadIngestSettings(workspaceId)
    return {
      configured: Boolean(settings.secretHash),
      autoAck: settings.autoAck === true,
      updatedAt: settings.updatedAt,
    }
  })
}

/**
 * Returns the secret exactly once. It is stored only as a sha256 hash, so
 * there is no way to recover it afterwards — the caller must put it in the
 * portal's webhook config before discarding it.
 */
export async function createIngestSecretAction(workspaceId: string): Promise<Result<{ secret: string }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id, "ADMIN")

    const { secret } = await createIngestSecret(workspaceId, session.user.id)
    return { secret }
  })
}

export async function revokeIngestSecretAction(workspaceId: string): Promise<Result<{ revoked: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id, "ADMIN")

    await revokeIngestSecret(workspaceId, session.user.id)
    return { revoked: true }
  })
}

/**
 * Turn WhatsApp auto-ack on or off.
 *
 * On means: brand-new leads arriving through an authenticated or anti-spam
 * gated ingress get an acknowledgement message. Only enable it for sources
 * where the enquirer genuinely gave their number in good faith.
 */
export async function setAutoAckAction(
  workspaceId: string,
  enabled: boolean
): Promise<Result<{ autoAck: boolean }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id, "ADMIN")

    await setAutoAck(workspaceId, enabled, session.user.id)
    return { autoAck: enabled }
  })
}