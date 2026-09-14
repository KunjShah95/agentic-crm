"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BadgeCheck, Copy, Plug, RefreshCw, Unlink, TriangleAlert, Wifi } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getWhatsAppStatusAction,
  linkPlatformNumberAction,
  subscribeWhatsAppWebhookAction,
  testWhatsAppConnectionAction,
  disconnectWhatsAppAction,
  getWhatsAppConnectUrlAction,
  type WhatsAppConnectionView,
} from "@/lib/actions/whatsapp"

type Readiness = { ok: boolean; missing: string[]; configured: string[] }

export function WhatsAppPanel({
  workspaceId,
  canManage,
  connection,
  readiness,
  webhookUrl,
  verifyTokenConfigured,
  graphVersion,
  stats,
}: {
  workspaceId: string
  canManage: boolean
  connection: WhatsAppConnectionView | null
  readiness: Readiness
  webhookUrl: string
  verifyTokenConfigured: boolean
  graphVersion: string
  stats: { total: number; inbound: number }
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [info, setInfo] = useState<Record<string, unknown> | null>(null)
  const [copied, setCopied] = useState(false)
  const [, startRefresh] = useTransition()

  const status = connection?.status ?? "disconnected"
  const active = status === "active"

  async function run(label: string, fn: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(label)
    try {
      const res = await fn()
      if (!res.ok) toast.error(res.message ?? `${label} failed`)
      else toast.success(res.message ?? `${label} ok`)
    } finally {
      setBusy(null)
    }
  }

  async function handleLink() {
    await run("Link", async () => {
      const res = await linkPlatformNumberAction(workspaceId)
      if (res.error) return { ok: false, message: res.error.message }
      toast.success(`Linked ${res.data.connection.displayName ?? res.data.connection.phoneNumberId}`)
      router.refresh()
      return { ok: true }
    })
  }

  async function handleOAuth() {
    await run("Connect", async () => {
      const res = await getWhatsAppConnectUrlAction(workspaceId)
      if (res.error) return { ok: false, message: res.error.message }
      window.location.href = res.data.url
      return { ok: true }
    })
  }

  async function handleTest() {
    await run("Test", async () => {
      const res = await testWhatsAppConnectionAction(workspaceId)
      if (res.error) return { ok: false, message: res.error.message }
      setInfo(res.data.info)
      return { ok: true, message: "Meta confirmed the connection." }
    })
  }

  async function handleSubscribe() {
    await run("Subscribe", async () => {
      const res = await subscribeWhatsAppWebhookAction(workspaceId)
      if (res.error) return { ok: false, message: res.error.message }
      return res.data.ok
        ? { ok: true, message: `Subscribed to ${res.data.fields.join(", ")}` }
        : { ok: false, message: res.data.error ?? "Subscription rejected" }
    })
  }

  function handleDisconnect() {
    if (!connection) return
    startRefresh(async () => {
      const res = await disconnectWhatsAppAction(workspaceId, connection.id)
      if (res.error) {
        toast.error(res.error.message)
        return
      }
      toast.success("WhatsApp disconnected")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Connection
            <Badge variant={active ? "secondary" : status === "needs_reauth" ? "destructive" : "outline"}>
              {active ? "connected" : status.replace("_", " ")}
            </Badge>
          </CardTitle>
          <CardDescription>
            {connection
              ? `${connection.displayName ?? connection.phoneNumberId ?? connection.externalAccountId} · number id ${connection.phoneNumberId ?? "—"}`
              : "No WhatsApp number linked to this workspace yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!canManage ? (
            <p className="text-xs text-muted-foreground">Only admins can change the WhatsApp connection.</p>
          ) : null}

          {status === "needs_reauth" ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Meta no longer accepts the stored token. Reconnect to resume delivery.
            </p>
          ) : null}

          {!readiness.ok ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
              <p className="flex items-center gap-1.5 font-medium text-destructive">
                <TriangleAlert className="size-3.5" /> Server credentials missing
              </p>
              <p className="mt-1 text-muted-foreground">
                Set these environment variables, then reload:{" "}
                <code className="font-mono">{readiness.missing.join(", ") || "WHATSAPP_*"}</code>
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {canManage && !connection ? (
              <Button size="sm" onClick={handleLink} disabled={busy !== null || !readiness.ok}>
                <Plug className="mr-1 size-3.5" />
                {busy === "Link" ? "Linking…" : "Link this workspace's number"}
              </Button>
            ) : null}
            {canManage && readiness.configured.includes("WHATSAPP_APP_ID") ? (
              <Button size="sm" variant="outline" onClick={handleOAuth} disabled={busy !== null}>
                Connect a different WhatsApp Business Account
              </Button>
            ) : null}
            {canManage && connection ? (
              <>
                <Button size="sm" variant="outline" onClick={handleTest} disabled={busy !== null}>
                  <Wifi className="mr-1 size-3.5" />
                  {busy === "Test" ? "Checking…" : "Test connection"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleSubscribe} disabled={busy !== null}>
                  <RefreshCw className="mr-1 size-3.5" />
                  {busy === "Subscribe" ? "Subscribing…" : "Re-subscribe webhooks"}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDisconnect} disabled={busy !== null}>
                  <Unlink className="mr-1 size-3.5" />
                  Disconnect
                </Button>
              </>
            ) : null}
          </div>

          {info ? (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-[11px]">
              {JSON.stringify(info, null, 2)}
            </pre>
          ) : null}

          {connection?.lastSyncAt ? (
            <p className="text-xs text-muted-foreground">
              Last inbound sync: {new Date(connection.lastSyncAt).toLocaleString("en-IN")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receive messages</CardTitle>
          <CardDescription>
            Meta delivers inbound WhatsApp to one callback URL for the whole app. Point your Meta app here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Callback URL</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 font-mono text-xs">{webhookUrl}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard?.writeText(webhookUrl)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? <BadgeCheck className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
          <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">
            <li>Meta app dashboard → WhatsApp → Configuration.</li>
            <li>
              Set <strong>Callback URL</strong> to the value above and <strong>Verify token</strong> to your{" "}
              <code className="font-mono">WHATSAPP_VERIFY_TOKEN</code>
              {verifyTokenConfigured ? "" : " (not set yet — inbound verification will fail until it is)"}.
            </li>
            <li>
              Click <strong>Verify and save</strong>, then subscribe the <code className="font-mono">messages</code> field
              (use “Re-subscribe webhooks” above, or add it in Webhooks → App fields).
            </li>
            <li>
              Test by sending a WhatsApp message to the linked number — it appears in the inbox within seconds. Graph{" "}
              <code className="font-mono">{graphVersion}</code>.
            </li>
          </ol>
          <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
            Meta does not expose historical message bodies. Messages are captured from the moment the webhook is
            subscribed — {stats.total} message{stats.total === 1 ? "" : "s"} stored so far ({stats.inbound} inbound).
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
