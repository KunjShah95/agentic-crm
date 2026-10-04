import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { getWhatsAppConfig, whatsappReadiness, whatsappWebhookUrl, whatsappEnabled } from "@/modules/whatsapp/config"
import { WhatsAppPanel } from "@/components/social/whatsapp-panel"

export const metadata: Metadata = { title: "WhatsApp connection" }
export const dynamic = "force-dynamic"

const CONNECT_NOTES: Record<string, string> = {
  connect_cancelled: "Meta sign-in was cancelled.",
  invalid_state: "The sign-in link expired or was malformed. Start again.",
  state_mismatch: "That sign-in was started by a different user.",
  state_expired: "The sign-in attempt timed out. Start again.",
  not_authorized: "You need the Admin role to connect WhatsApp.",
  token_exchange_failed: "Meta rejected the authorisation code. Try connecting again.",
  no_account_identity: "Meta returned no WhatsApp Business Account for this login.",
  save_failed: "Could not save the connection. Try again.",
}

const WARNING_NOTES: Record<string, string> = {
  webhook_not_subscribed:
    "The account is linked, but Meta is not yet delivering messages to us. Subscribe the app below.",
}

export default async function WhatsAppSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>
  searchParams: Promise<{ connected?: string; error?: string; warning?: string; detail?: string }>
}) {
  const { workspace: slug } = await params
  const { connected, error, warning, detail } = await searchParams
  const session = await auth()

  const workspace = await db.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true },
  })
  if (!workspace) notFound()

  const membership = session?.user?.id
    ? await db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: session.user.id } },
      })
    : null
  if (!membership) notFound()

  // The integration is parked by an env switch rather than removed, so this
  // route stays live and explains itself. `WhatsAppPanel` is only reachable when
  // the switch is on, which is what keeps link / disconnect / re-subscribe and
  // the inbound webhook disabled together — the same single gate the outbox and
  // the webhook consult.
  if (!whatsappEnabled()) {
    return (
      <div className="flex max-w-3xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            The WhatsApp integration is currently disabled. Contact your administrator to enable it.
          </p>
        </div>
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Messaging, inbound webhooks and connection management are turned off. Existing conversation
          history is preserved and will reappear once the integration is re-enabled.
        </div>
        <div className="pt-2">
          <Button variant="outline" size="sm" render={<Link href={`/${slug}/settings`} />}>
            Back to settings
          </Button>
        </div>
      </div>
    )
  }

  const cfg = getWhatsAppConfig()
  const readiness = whatsappReadiness(cfg)

  const connection = await db.socialConnection.findFirst({
    where: { workspaceId: workspace.id, provider: "whatsapp" },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      status: true,
      displayName: true,
      externalAccountId: true,
      metadata: true,
      lastSyncAt: true,
      expiresAt: true,
    },
  })

  // Count what has actually landed, so the page proves data is flowing.
  const [messageCount, needsReply] = await Promise.all([
    db.activity.count({ where: { workspaceId: workspace.id, channel: "WHATSAPP" } }),
    db.activity.count({ where: { workspaceId: workspace.id, channel: "WHATSAPP", direction: "IN" } }),
  ])

  const canManage = membership.role === "ADMIN" || membership.role === "OWNER"

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Link {workspace.name} to WhatsApp so inbound messages land in the inbox and agents can reply.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">{CONNECT_NOTES[error] ?? "Could not connect WhatsApp."}</p>
          {detail ? <p className="mt-1 break-words text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      ) : null}

      {connected === "whatsapp" ? (
        // Status tokens rather than emerald/amber literals: these banners state a
        // system state, and the raw pair only reads correctly on a light
        // background. `positive` and `caution` are contrast-checked in both themes.
        <div className="rounded-md border border-status-positive-fg/40 bg-status-positive-bg px-4 py-3 text-sm">
          <p className="font-medium text-status-positive-fg">WhatsApp connected.</p>
          {warning ? (
            <p className="mt-1 text-xs text-status-caution-fg">{WARNING_NOTES[warning] ?? warning}</p>
          ) : null}
        </div>
      ) : null}

      <WhatsAppPanel
        workspaceId={workspace.id}
        slug={slug}
        canManage={canManage}
        connection={
          connection
            ? {
                id: connection.id,
                status: connection.status,
                displayName: connection.displayName,
                externalAccountId: connection.externalAccountId,
                phoneNumberId: ((connection.metadata as Record<string, unknown> | null)?.phoneNumberId ?? null) as string | null,
                wabaId: ((connection.metadata as Record<string, unknown> | null)?.wabaId ?? null) as string | null,
                lastSyncAt: connection.lastSyncAt ? connection.lastSyncAt.toISOString() : null,
                expiresAt: connection.expiresAt ? connection.expiresAt.toISOString() : null,
              }
            : null
        }
        readiness={{ ok: readiness.canSend && readiness.canReceive, missing: readiness.missing, configured: readiness.configured }}
        webhookUrl={whatsappWebhookUrl(cfg)}
        verifyTokenConfigured={Boolean(cfg.verifyToken)}
        graphVersion={cfg.graphVersion}
        stats={{ total: messageCount, inbound: needsReply }}
      />

      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" render={<Link href={`/${slug}/settings`} />}>
          Back to settings
        </Button>
      </div>
    </div>
  )
}