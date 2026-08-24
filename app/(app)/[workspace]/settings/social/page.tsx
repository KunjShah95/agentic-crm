import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { ConnectionCard } from "@/components/social/connection-card"
import { ReconnectBanner } from "@/components/social/reconnect-banner"

export const metadata: Metadata = { title: "Social connections" }

const PROVIDERS = [
  { provider: "linkedin", label: "LinkedIn", description: "Sync LinkedIn messages via Unipile." },
  { provider: "x", label: "X", description: "Connect your X (Twitter) account for DMs and mentions." },
  { provider: "whatsapp", label: "WhatsApp", description: "Connect WhatsApp Cloud for inbound messages." },
] as const

export default async function SocialSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>
}) {
  const { workspace: slug } = await params
  const session = await auth()

  const workspace = await db.workspace.findUnique({ where: { slug } })
  if (!workspace) notFound()

  const membership = session?.user?.id
    ? await db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: session.user.id } },
      })
    : null
  if (!membership) notFound()

  const connections = await db.socialConnection.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  })

  const byProvider = new Map(connections.map((c) => [c.provider.toLowerCase(), c]))

  const needsReauthProviders = connections
    .filter((c) => c.status === "needs_reauth")
    .map((c) => c.provider)

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Social connections</h1>
        <p className="text-sm text-muted-foreground">
          Connect LinkedIn, X, and WhatsApp for {workspace.name}. Each provider syncs via webhooks.
        </p>
      </div>

      {needsReauthProviders.length > 0 ? <ReconnectBanner providers={needsReauthProviders} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {PROVIDERS.map((p) => {
          const conn = byProvider.get(p.provider) ?? null
          return (
            <ConnectionCard
              key={p.provider}
              workspaceId={workspace.id}
              provider={p.provider}
              label={p.label}
              description={p.description}
              connection={
                conn
                  ? {
                      id: conn.id,
                      provider: conn.provider,
                      externalAccountId: conn.externalAccountId,
                      displayName: conn.displayName,
                      status: conn.status,
                      lastSyncAt: conn.lastSyncAt ? conn.lastSyncAt.toISOString() : null,
                    }
                  : null
              }
            />
          )
        })}
      </div>

      {/* Render additional connections that don't match known providers (e.g., legacy names) */}
      {connections.filter((c) => !PROVIDERS.some((p) => p.provider === c.provider.toLowerCase())).length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {connections
            .filter((c) => !PROVIDERS.some((p) => p.provider === c.provider.toLowerCase()))
            .map((conn) => (
              <ConnectionCard
                key={conn.id}
                workspaceId={workspace.id}
                provider={conn.provider}
                label={conn.provider}
                description={`Connected as ${conn.externalAccountId}`}
                connection={{
                  id: conn.id,
                  provider: conn.provider,
                  externalAccountId: conn.externalAccountId,
                  displayName: conn.displayName,
                  status: conn.status,
                  lastSyncAt: conn.lastSyncAt ? conn.lastSyncAt.toISOString() : null,
                }}
              />
            ))}
        </div>
      ) : null}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" render={<Link href={`/${slug}/settings`} />}>
          Back to settings
        </Button>
        <Button variant="link" size="sm" render={<Link href={`/${slug}/settings/billing`} />}>
          Billing
        </Button>
      </div>
    </div>
  )
}
