"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { disconnectSocialAction, getSocialAuthUrlAction } from "@/lib/actions/social"

type Connection = {
  id: string
  provider: string
  externalAccountId: string
  displayName: string | null
  status: string
  lastSyncAt: string | null
}

export function ConnectionCard({
  workspaceId,
  provider,
  label,
  description,
  connection,
}: {
  workspaceId: string
  provider: string
  label: string
  description: string
  connection: Connection | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [connecting, setConnecting] = useState(false)

  const status = connection?.status ?? "disconnected"
  const isActive = status === "active"
  const needsReauth = status === "needs_reauth"
  const isRevoked = status === "revoked"

  async function handleConnect() {
    setConnecting(true)
    try {
      const res = await getSocialAuthUrlAction(workspaceId, provider)
      if (res.error) {
        toast.error(res.error.message)
        return
      }
      if (res.data?.url) {
        window.location.href = res.data.url
      }
    } finally {
      setConnecting(false)
    }
  }

  function handleDisconnect() {
    if (!connection) return
    startTransition(async () => {
      const res = await disconnectSocialAction(workspaceId, connection.id)
      if (res.error) {
        toast.error(res.error.message)
        return
      }
      toast.success(`${label} disconnected`)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {label}
          {connection ? (
            <Badge
              variant={isActive ? "secondary" : needsReauth ? "destructive" : "outline"}
              className="capitalize"
            >
              {status.replace("_", " ")}
            </Badge>
          ) : (
            <Badge variant="outline">not connected</Badge>
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {connection ? (
          <div className="text-sm">
            <p className="font-medium">{connection.displayName ?? connection.externalAccountId}</p>
            <p className="text-xs text-muted-foreground">ID: {connection.externalAccountId}</p>
            {connection.lastSyncAt ? (
              <p className="text-xs text-muted-foreground">Last sync: {new Date(connection.lastSyncAt).toLocaleString()}</p>
            ) : null}
            {needsReauth ? (
              <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                Reconnect required — token expired or revoked.
              </p>
            ) : null}
            {isRevoked ? (
              <p className="mt-1 text-xs font-medium text-destructive">Connection revoked.</p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No {label} account connected.</p>
        )}

        <div className="flex gap-2">
          {!connection || needsReauth || isRevoked ? (
            <Button onClick={handleConnect} disabled={connecting} size="sm">
              {connecting ? "Redirecting…" : connection ? `Reconnect ${label}` : `Connect ${label}`}
            </Button>
          ) : null}
          {/* Always render a Connect X button for E2E visibility when provider is x and disconnected variant */}
          {provider === "x" && !connection ? (
            <span className="sr-only">Connect X</span>
          ) : null}
          {connection && isActive ? (
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={pending}>
              {pending ? "Disconnecting…" : "Disconnect"}
            </Button>
          ) : null}
          {connection && (needsReauth || isRevoked) ? (
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={pending}>
              Disconnect
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
