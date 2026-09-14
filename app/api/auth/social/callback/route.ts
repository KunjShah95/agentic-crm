import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { getProvider } from "@/modules/social/provider"
import { createConnection } from "@/modules/social/connections"
import { AppError } from "@/lib/errors"

/**
 * GET /api/auth/social/callback?provider=x|twitter|linkedin|whatsapp&code=...&state=...
 *
 * Shared OAuth callback for all social providers.
 * Provider-specific routes (x, whatsapp, linkedin) redirect here or can be mounted separately.
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

/**
 * Build the webhook URL for the current deployment.
 * Uses the request's host header, falling back to VERCEL_URL or localhost.
 */
function buildWebhookUrl(req: Request, provider: string): string {
  const host = req.headers.get("host") ?? "localhost:3000"
  const protocol = req.headers.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http")
  return `${protocol}://${host}/api/webhooks/social/${provider}`
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return redirect(`/login?error=unauthenticated`)
  }

  const url = new URL(req.url)
  const provider = (url.searchParams.get("provider") ?? "").toLowerCase().trim()
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  if (error) {
    return redirect(`/settings/social?error=provider_rejected&detail=${encodeURIComponent(error)}`)
  }

  if (!provider || !code || !state) {
    return redirect(`/settings/social?error=invalid_callback`)
  }

  const decoded = decodeState(state)
  if (!decoded || decoded.provider !== provider) {
    return redirect(`/settings/social?error=invalid_state`)
  }

  const { workspaceId, nonce } = decoded

  // Verify the user is a workspace member
  await requireWorkspaceMember(workspaceId, session.user.id)

  let providerInstance
  try {
    providerInstance = getProvider(provider)
  } catch {
    return redirect(`/settings/social?error=unknown_provider`)
  }

  // Exchange code for tokens
  let tokens
  try {
    tokens = await providerInstance.handleCallback({ code, state: nonce })
  } catch (err) {
    console.error(`[social-callback:${provider}] token exchange failed`, err)
    return redirect(`/settings/social?error=token_exchange_failed`)
  }

  if (!tokens.accessToken) {
    return redirect(`/settings/social?error=no_access_token`)
  }

  // Determine externalAccountId from provider
  let externalAccountId: string
  let displayName: string | undefined

  try {
    // X: use the user id from raw response if available
    const raw = tokens.raw as Record<string, unknown> | undefined
    if (provider === "x" && raw?.["user_id"]) {
      externalAccountId = String(raw.user_id)
      displayName = String(raw.name ?? raw.screen_name ?? externalAccountId)
    } else if (provider === "whatsapp" && raw?.["business_account"]) {
      const ba = raw.business_account as Record<string, unknown>
      externalAccountId = String(ba.id ?? ba.phone_number_id ?? "wa_unknown")
      displayName = String(ba.name ?? externalAccountId)
    } else if (provider.startsWith("linkedin") || provider === "unipile") {
      // Unipile: list accounts and pick the linked one
      const accounts = raw as Array<Record<string, unknown>> | undefined
      if (Array.isArray(accounts) && accounts.length > 0) {
        const acct = accounts[0]
        externalAccountId = String(acct.id ?? acct.provider_id ?? "li_unknown")
        displayName = String(acct.display_name ?? acct.name ?? externalAccountId)
      } else {
        externalAccountId = `li_${Date.now()}`
        displayName = "LinkedIn Account"
      }
    } else {
      externalAccountId = `unknown_${Date.now()}`
      displayName = undefined
    }
  } catch {
    externalAccountId = `auto_${Date.now()}`
  }

  // Create/update the SocialConnection with encrypted tokens
  try {
    await createConnection({
      workspaceId,
      provider: providerInstance.name,
      externalAccountId,
      displayName,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    })
  } catch (err) {
    console.error(`[social-callback:${provider}] connection save failed`, err)
    return redirect(`/settings/social?error=save_failed`)
  }

  // Register webhook with provider so inbound events flow to this workspace
  const webhookUrl = buildWebhookUrl(req, provider)
  try {
    const registerFn = providerInstance.registerWebhook
    if (registerFn) {
      const result = await registerFn({
        accessToken: tokens.accessToken,
        workspaceId,
        webhookUrl,
        provider: providerInstance.name,
      })
      if (result?.ok) {
        console.log(`[social-callback:${provider}] webhook registered: ${webhookUrl}`)
      } else {
        console.warn(`[social-callback:${provider}] webhook registration skipped/failed (provider may not support it)`)
      }
    }
  } catch (err) {
    // Webhook registration failure should not block the connection
    console.error(`[social-callback:${provider}] webhook registration error`, err)
  }

  return redirect(`/settings/social?connected=${providerInstance.name}`)
}
