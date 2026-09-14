import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireWorkspaceMember } from "@/lib/permissions"
import { getProvider } from "@/modules/social/provider"
import { createConnection } from "@/modules/social/connections"
import { decodeState, consumeOAuthState } from "@/modules/social/oauth-state"

export const dynamic = "force-dynamic"

/**
 * GET /api/auth/whatsapp/callback?code=...&state=...
 *
 * Meta OAuth callback. Every failure path redirects back to the workspace-scoped
 * settings route with a reason — previously these redirected to `/settings/social`
 * without the `/${slug}` prefix, so every error 404'd and users saw nothing.
 */

/** Error redirects must carry the workspace slug or they land on a 404. */
function fail(slug: string | null | undefined, reason: string, detail?: string) {
  const params = new URLSearchParams({ error: reason })
  if (detail) params.set("detail", detail.slice(0, 200))
  return redirect(slug ? `/${slug}/settings/social?${params.toString()}` : `/login?error=${reason}`)
}

function ok(slug: string) {
  return redirect(`/${slug}/settings/social?connected=whatsapp`)
}

export async function GET(req: Request) {
  const session = await auth()
  const url = new URL(req.url)
  const stateParam = url.searchParams.get("state")
  const preview = decodeState(stateParam)

  // Without a verifiable state we cannot know which workspace to return to.
  const slug = preview?.workspaceSlug ?? null

  if (url.searchParams.get("error")) {
    return fail(slug, "connect_cancelled", url.searchParams.get("error_description") ?? undefined)
  }
  if (!session?.user?.id) return fail(null, "unauthenticated")

  const code = url.searchParams.get("code")
  if (!code || !preview) return fail(slug, "invalid_state")

  const { workspaceId, workspaceSlug } = preview
  if (preview.userId !== session.user.id) return fail(workspaceSlug, "state_mismatch")
  if (!(await consumeOAuthState(preview))) return fail(workspaceSlug, "state_expired")

  let membership
  try {
    membership = await requireWorkspaceMember(workspaceId, session.user.id, "ADMIN")
  } catch {
    return fail(workspaceSlug, "not_authorized")
  }

  const provider = getProvider("whatsapp")
  let tokens
  try {
    tokens = await provider.handleCallback({ code })
  } catch (err) {
    console.error("[whatsapp-callback] token exchange failed", err)
    return fail(membership.workspace.slug, "token_exchange_failed", err instanceof Error ? err.message : undefined)
  }

  if (!tokens.accessToken || !tokens.externalAccountId) {
    return fail(membership.workspace.slug, "no_account_identity")
  }

  try {
    await createConnection({
      workspaceId,
      provider: "whatsapp",
      externalAccountId: tokens.externalAccountId,
      displayName: tokens.displayName,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      metadata: tokens.metadata,
    })
  } catch (err) {
    console.error("[whatsapp-callback] connection save failed", err)
    return fail(membership.workspace.slug, "save_failed")
  }

  // Ask Meta for the delivery subscriptions; surface but do not fail on errors.
  try {
    const sub = await provider.subscribeWebhook?.({
      accessToken: tokens.accessToken,
      metadata: tokens.metadata ?? {},
    })
    if (sub && !sub.ok) {
      console.warn("[whatsapp-callback] webhook subscription incomplete:", sub.error)
      return redirect(`/${membership.workspace.slug}/settings/social?connected=whatsapp&warning=webhook_not_subscribed`)
    }
  } catch (err) {
    console.warn("[whatsapp-callback] subscribe threw", err)
  }

  return ok(membership.workspace.slug)
}
