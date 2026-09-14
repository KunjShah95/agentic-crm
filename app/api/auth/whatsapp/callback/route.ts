import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { getProvider } from "@/modules/social/provider"
import { createConnection } from "@/modules/social/connections"

/**
 * GET /api/auth/whatsapp/callback?code=...&state=...
 *
 * WhatsApp Cloud (Meta) OAuth callback. Exchanges code for a long-lived access token
 * and creates a SocialConnection.
 */
export const dynamic = "force-dynamic"

function decodeState(state: string): { workspaceId: string; provider: string; nonce: string } | null {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      workspaceId: string
      provider: string
      nonce: string
    }
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return redirect(`/login?error=unauthenticated`)
  }

  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  if (error) {
    return redirect(`/settings/social?error=whatsapp_rejected&detail=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return redirect(`/settings/social?error=invalid_callback`)
  }

  const decoded = decodeState(state)
  if (!decoded) {
    return redirect(`/settings/social?error=invalid_state`)
  }

  const { workspaceId } = decoded
  await requireWorkspaceMember(workspaceId, session.user.id)

  let tokens
  try {
    const provider = getProvider("whatsapp")
    tokens = await provider.handleCallback({ code, state })
  } catch (err) {
    console.error("[whatsapp-callback] token exchange failed", err)
    return redirect(`/settings/social?error=token_exchange_failed`)
  }

  if (!tokens.accessToken) {
    return redirect(`/settings/social?error=no_access_token`)
  }

  // Extract WhatsApp business account info from raw response
  let externalAccountId = `wa_${Date.now()}`
  let displayName: string | undefined
  try {
    const raw = tokens.raw as Record<string, unknown> | undefined
    if (raw?.["business_account"] && typeof raw.business_account === "object") {
      const ba = raw.business_account as Record<string, unknown>
      externalAccountId = String(ba.id ?? ba.phone_number_id ?? externalAccountId)
      displayName = String(ba.name ?? displayName)
    } else if (raw?.["id"]) {
      externalAccountId = String(raw.id)
    }
  } catch {
    // use fallback
  }

  try {
    await createConnection({
      workspaceId,
      provider: "whatsapp",
      externalAccountId,
      displayName,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    })
  } catch (err) {
    console.error("[whatsapp-callback] connection save failed", err)
    return redirect(`/settings/social?error=save_failed`)
  }

  return redirect(`/settings/social?connected=whatsapp`)
}
