"use server"

import crypto from "crypto"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleAction, type Result } from "@/lib/actions"
import { AppError } from "@/lib/errors"
import { requireWorkspaceMember } from "@/lib/permissions"
import { getProvider } from "@/modules/social/provider"
import {
  createConnection,
  decryptAccessToken,
  deleteConnection,
  getActiveConnection,
} from "@/modules/social/connections"
import { rememberOAuthState } from "@/modules/social/oauth-state"
import { getWhatsAppConfig, whatsappReadiness, whatsappWebhookUrl } from "@/modules/whatsapp/config"
import { cloudPhoneNumberInfo } from "@/modules/whatsapp/cloud"

/**
 * WhatsApp connection management.
 *
 * Two ways to link, because the product runs a platform-shared number but must
 * still support a workspace bringing its own:
 *   1. linkPlatformNumber() — uses the app's configured Cloud API credentials.
 *   2. getConnectUrl()      — Meta OAuth, for a workspace-owned WABA.
 * Both end in the same encrypted SocialConnection row with metadata.phoneNumberId,
 * which is what inbound webhooks route on.
 */

async function requireAdmin(workspaceId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
  const membership = await requireWorkspaceMember(workspaceId, session.user.id, "ADMIN")
  return { userId: session.user.id, slug: membership.workspace.slug }
}

export type WhatsAppConnectionView = {
  id: string
  status: string
  displayName: string | null
  externalAccountId: string
  phoneNumberId: string | null
  wabaId: string | null
  lastSyncAt: string | null
  expiresAt: string | null
}

function toView(conn: Awaited<ReturnType<typeof getActiveConnection>>): WhatsAppConnectionView | null {
  if (!conn) return null
  const meta = (conn.metadata ?? {}) as Record<string, unknown>
  return {
    id: conn.id,
    status: conn.status,
    displayName: conn.displayName,
    externalAccountId: conn.externalAccountId,
    phoneNumberId: meta.phoneNumberId ? String(meta.phoneNumberId) : null,
    wabaId: meta.wabaId ? String(meta.wabaId) : null,
    lastSyncAt: conn.lastSyncAt ? conn.lastSyncAt.toISOString() : null,
    expiresAt: conn.expiresAt ? conn.expiresAt.toISOString() : null,
  }
}

export async function getWhatsAppStatusAction(
  workspaceId: string,
): Promise<Result<{ connection: WhatsAppConnectionView | null; readiness: ReturnType<typeof whatsappReadiness>; webhookUrl: string; verifyTokenHint: string }>> {
  return handleAction(async () => {
    await requireAdmin(workspaceId)
    const cfg = getWhatsAppConfig()
    const connection = await getActiveConnection(workspaceId, "whatsapp")
    return {
      connection: toView(connection),
      readiness: whatsappReadiness(cfg),
      webhookUrl: whatsappWebhookUrl(cfg),
      // Never echo the real token to the client; tell the admin where to find it.
      verifyTokenHint: cfg.verifyToken ? "WHATSAPP_VERIFY_TOKEN is set" : "WHATSAPP_VERIFY_TOKEN is missing",
    }
  })
}

/**
 * Bind the platform-configured number to this workspace. Verifies against Meta
 * first, so a typo'd token fails here instead of quietly storing a dead link.
 */
export async function linkPlatformNumberAction(
  workspaceId: string,
): Promise<Result<{ connection: WhatsAppConnectionView; verifiedName: string | null }>> {
  return handleAction(async () => {
    const { slug } = await requireAdmin(workspaceId)
    const cfg = getWhatsAppConfig()
    const readiness = whatsappReadiness(cfg)
    if (!readiness.canSend) {
      throw new AppError(
        "WHATSAPP_NOT_CONFIGURED",
        `WhatsApp needs ${readiness.missing.join(", ")} before it can be linked.`,
        400,
      )
    }

    let info
    try {
      info = await cloudPhoneNumberInfo({ phoneNumberId: cfg.phoneNumberId, token: cfg.accessToken })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new AppError("WHATSAPP_VERIFY_FAILED", `Meta rejected these credentials: ${message}`, 400)
    }

    const wabaId = cfg.wabaId || null
    const conn = await createConnection({
      workspaceId,
      provider: "whatsapp",
      externalAccountId: info.phoneNumberId,
      displayName: info.displayPhoneNumber ?? info.verifiedName ?? undefined,
      accessToken: cfg.accessToken,
      metadata: { phoneNumberId: info.phoneNumberId, wabaId, graphVersion: cfg.graphVersion },
    })

    // Persisting the binding on the workspace keeps the legacy router in sync.
    await db.workspace
      .update({
        where: { id: workspaceId },
        data: { settingsJson: { whatsappPhoneId: info.phoneNumberId } as never },
      })
      .catch(() => undefined)

    const provider = getProvider("whatsapp")
    const sub = await provider.subscribeWebhook?.({ accessToken: cfg.accessToken, metadata: { phoneNumberId: info.phoneNumberId } })
    if (sub && !sub.ok) {
      console.warn(`[social] webhook subscribe failed for ${slug}: ${sub.error}`)
    }

    return { connection: toView(conn)!, verifiedName: info.verifiedName }
  })
}

/** Begin Meta OAuth so a workspace can attach its own WhatsApp Business Account. */
export async function getWhatsAppConnectUrlAction(workspaceId: string): Promise<Result<{ url: string }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    const membership = await requireWorkspaceMember(workspaceId, session.user.id, "ADMIN")

    const provider = getProvider("whatsapp")
    if (!provider.isConfigured()) {
      const readiness = whatsappReadiness()
      throw new AppError("WHATSAPP_NOT_CONFIGURED", `Set ${readiness.missing.join(", ")} to enable OAuth linking.`, 400)
    }

    const state = await rememberOAuthState({
      workspaceId,
      workspaceSlug: membership.workspace.slug,
      userId: session.user.id,
      provider: "whatsapp",
      nonce: crypto.randomBytes(16).toString("hex"),
      iat: Math.floor(Date.now() / 1000),
    })

    return { url: await provider.getAuthUrl(state) }
  })
}

/** Live read-back from Meta — proof the stored token still works. */
export async function testWhatsAppConnectionAction(
  workspaceId: string,
): Promise<Result<{ ok: true; info: Record<string, unknown> }>> {
  return handleAction(async () => {
    await requireAdmin(workspaceId)
    const conn = await getActiveConnection(workspaceId, "whatsapp")
    if (!conn) throw new AppError("NO_CONNECTION", "Link WhatsApp first.", 404)

    const meta = (conn.metadata ?? {}) as Record<string, unknown>
    const provider = getProvider("whatsapp")
    try {
      const info = await provider.fetchAccountInfo?.({ accessToken: decryptAccessToken(conn.accessTokenEnc), metadata: meta })
      await db.socialConnection.update({ where: { id: conn.id }, data: { lastSyncAt: new Date(), status: "active" } })
      return { ok: true, info: (info ?? {}) as Record<string, unknown> }
    } catch (err) {
      await db.socialConnection.update({ where: { id: conn.id }, data: { status: "needs_reauth" } })
      const message = err instanceof Error ? err.message : String(err)
      throw new AppError("WHATSAPP_VERIFY_FAILED", `Meta could not confirm this connection: ${message}`, 400)
    }
  })
}

/** Re-run Meta webhook subscription without re-linking. */
export async function subscribeWhatsAppWebhookAction(
  workspaceId: string,
): Promise<Result<{ ok: boolean; fields: string[]; error?: string }>> {
  return handleAction(async () => {
    await requireAdmin(workspaceId)
    const conn = await getActiveConnection(workspaceId, "whatsapp")
    const cfg = getWhatsAppConfig()
    const provider = getProvider("whatsapp")
    const result = await provider.subscribeWebhook?.({
      accessToken: conn ? decryptAccessToken(conn.accessTokenEnc) : cfg.accessToken,
      metadata: ((conn?.metadata ?? {}) as Record<string, unknown>) || { phoneNumberId: cfg.phoneNumberId },
    })
    if (!result) throw new AppError("UNSUPPORTED", "This provider cannot register webhooks.", 400)
    return result
  })
}

export async function disconnectWhatsAppAction(workspaceId: string, connectionId: string): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    await requireAdmin(workspaceId)
    const conn = await db.socialConnection.findFirst({ where: { id: connectionId, workspaceId } })
    if (!conn) throw new AppError("NOT_FOUND", "Connection not found.", 404)
    await deleteConnection(connectionId)
    return { ok: true }
  })
}
