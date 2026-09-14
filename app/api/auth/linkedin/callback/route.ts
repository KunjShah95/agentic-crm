import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { getProvider } from "@/modules/social/provider"
import { createConnection } from "@/modules/social/connections"

/**
 * GET /api/auth/linkedin/callback?code=...&state=...
 *
 * LinkedIn via Unipile hosted auth callback.
 * Unipile's hosted flow typically calls the notify_url directly, but this
 * endpoint handles the direct OAuth code exchange path too.
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
    return redirect(`/settings/social?error=linkedin_rejected&detail=${encodeURIComponent(error)}`)
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
    const provider = getProvider("linkedin")
    tokens = await provider.handleCallback({ code, state })
  } catch (err) {
    console.error("[linkedin-callback] token exchange failed", err)
    return redirect(`/settings/social?error=token_exchange_failed`)
  }

  if (!tokens.accessToken) {
    return redirect(`/settings/social?error=no_access_token`)
  }

  // Unipile: accounts are listed via API; use a stable identifier
  let externalAccountId = `li_${Date.now()}`
  let displayName: string | undefined

  try {
    const raw = tokens.raw as unknown
    if (Array.isArray(raw) && raw.length > 0) {
      const acct = raw[0] as Record<string, unknown>
      externalAccountId = String(acct.id ?? acct.provider_id ?? externalAccountId)
      displayName = String(acct.display_name ?? acct.name ?? externalAccountId)
    } else if (typeof raw === "object" && raw !== null) {
      const r = raw as Record<string, unknown>
      externalAccountId = String(r.id ?? r.provider_id ?? externalAccountId)
      displayName = String(r.display_name ?? r.name ?? displayName)
    }
  } catch {
    // use fallback
  }

  try {
    await createConnection({
      workspaceId,
      provider: "linkedin",
      externalAccountId,
      displayName,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    })
  } catch (err) {
    console.error("[linkedin-callback] connection save failed", err)
    return redirect(`/settings/social?error=save_failed`)
  }

  return redirect(`/settings/social?connected=linkedin`)
}
