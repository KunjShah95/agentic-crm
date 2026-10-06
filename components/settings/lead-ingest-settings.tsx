"use client"

import { useEffect, useState, useSyncExternalStore, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Check, Copy, KeyRound, LoaderCircle, Radio, RotateCcw } from "lucide-react"

import {
  getIngestStatusAction,
  createIngestSecretAction,
  revokeIngestSecretAction,
  setAutoAckAction,
} from "@/modules/leadIngest/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

/**
 * Lead-ingest controls: the shared secret that authenticates server-to-server
 * lead webhooks, and the WhatsApp auto-ack opt-in.
 *
 * Two things this screen is careful about:
 *
 * 1. The secret is shown exactly once. It is stored as a sha256 hash, so this
 *    component cannot re-display it — if the operator loses it they rotate,
 *    they do not retrieve. Copy it into the portal's config before navigating
 *    away.
 * 2. The auto-ack switch is labelled with its consequence, not its mechanism.
 *    Turning it on means real messages leave the business's WhatsApp number to
 *    numbers supplied by whoever posted to the lead form.
 */
export function LeadIngestSettings({
  workspaceId,
  workspaceSlug,
  canManage,
}: {
  workspaceId: string
  workspaceSlug: string
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [autoAck, setAutoAck] = useState(false)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Derived from where the browser actually is, so the endpoint shown is the
  // one this deployment serves — not a hardcoded domain that may not resolve.
  //
  // useSyncExternalStore rather than an effect + setState: it is the intended
  // way to read a browser-only value without a hydration mismatch, and the
  // empty server snapshot means the first client render matches the server.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  )

  useEffect(() => {
    let active = true
    void (async () => {
      const result = await getIngestStatusAction(workspaceId)
      if (!active) return
      if (result.data) {
        setConfigured(result.data.configured)
        setAutoAck(result.data.autoAck)
      } else {
        toast.error(result.error?.message ?? "Could not read lead-ingest status.")
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [workspaceId])

  function copy(text: string, what: string) {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success(`${what} copied`)
    setTimeout(() => setCopied(false), 2000)
  }

  function mintSecret() {
    startTransition(async () => {
      const result = await createIngestSecretAction(workspaceId)
      if (result.data) {
        setConfigured(true)
        setRevealed(result.data.secret)
        toast.success("Ingest secret created — copy it now, it cannot be shown again.")
      } else {
        toast.error(result.error?.message ?? "Could not create a secret.")
      }
    })
  }

  function revoke() {
    if (
      !confirm(
        "Revoke the ingest secret?\n\nAny portal still using the old key will stop delivering leads immediately. Create a replacement first if you are rotating."
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await revokeIngestSecretAction(workspaceId)
      if (result.data) {
        setConfigured(false)
        setRevealed(null)
        toast.success("Ingest secret revoked.")
        router.refresh()
      } else {
        toast.error(result.error?.message ?? "Could not revoke the secret.")
      }
    })
  }

  function toggleAutoAck(next: boolean) {
    const previous = autoAck
    setAutoAck(next) // optimistic; reverted below if the action fails
    startTransition(async () => {
      const result = await setAutoAckAction(workspaceId, next)
      if (result.data) {
        toast.success(
          next
            ? "Auto-ack enabled — new leads from authenticated sources will be messaged."
            : "Auto-ack disabled — new leads are captured but not messaged."
        )
        router.refresh()
      } else {
        setAutoAck(previous)
        toast.error(result.error?.message ?? "Could not change the auto-ack setting.")
      }
    })
  }

  const webhookUrl = `${origin}/api/webhooks/leads/{source}?workspace=${workspaceSlug}`

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead webhook secret</CardTitle>
          <CardDescription>
            Required on every server-to-server lead webhook. Without it,{" "}
            <code className="font-mono text-xs" data-mono="url">/api/webhooks/leads/*</code> refuses the request —
            otherwise anyone who knew your workspace slug could write leads into your pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {loading ? (
              <Badge variant="secondary">Checking…</Badge>
            ) : configured ? (
              <Badge className="gap-1">
                <Check className="size-3" /> Configured
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" /> Not configured
              </Badge>
            )}
          </div>

          {revealed ? (
            <div className="space-y-2 rounded-sm border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-900">
                Copy this now — only a hash is stored, so it cannot be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-sm bg-white px-2 py-1.5 font-mono text-xs" data-mono="secret">
                  {revealed}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(revealed, "Secret")}
                  disabled={isPending}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Endpoint</Label>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-sm bg-muted px-2 py-1.5 font-mono text-xs" data-mono="url">
                {webhookUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(webhookUrl, "Endpoint")}
                disabled={isPending}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send as header <code className="font-mono" data-mono="id">x-estate360-ingest-key</code>. Known sources:{" "}
              meta, 99acres, magicbricks, housing, nobroker, google, website, pabbly, zapier, indiamart, justdial,
              hubspot, zoho — plus any company slug (e.g. <code className="font-mono">acme-crm</code>) with zero code
              change. Full guide: <code className="font-mono">docs/integrations/lead-ingest.md</code>.
            </p>
          </div>

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={mintSecret} disabled={isPending}>
                {isPending ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : configured ? (
                  <RotateCcw className="size-3.5" />
                ) : (
                  <KeyRound className="size-3.5" />
                )}
                {configured ? "Rotate secret" : "Create secret"}
              </Button>
              {configured ? (
                <Button size="sm" variant="outline" onClick={revoke} disabled={isPending}>
                  Revoke
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only an owner or admin can change this.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp auto-ack</CardTitle>
          <CardDescription>
            Sends an acknowledgement to each brand-new lead that has a phone number.{" "}
            <strong>Off by default.</strong> On means real messages leave your business number to
            numbers supplied by whoever filled in a form — only enable it once you have confirmed
            your sources are ones where the enquirer gave their number in good faith.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-muted-foreground" />
              <Label htmlFor="auto-ack" className="text-sm">
                Message new leads automatically
              </Label>
            </div>
            <Switch
              id="auto-ack"
              checked={autoAck}
              disabled={!canManage || isPending || loading}
              onCheckedChange={toggleAutoAck}
            />
          </div>
          {!canManage ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Only an owner or admin can change this.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}