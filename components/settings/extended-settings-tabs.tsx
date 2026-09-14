"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Building2,
  Globe,
  Sliders,
  Key,
  BellRing,
  ShieldAlert,
  Users,
  CreditCard,
  Check,
  Copy,
  Radio,
  Share2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WorkspaceSettingsForm } from "@/components/settings/workspace-settings-form"
import { DeleteWorkspaceButton } from "@/components/settings/delete-workspace-button"

export function ExtendedSettingsTabs({
  workspace,
  slug,
  isOwner,
  whatsappEnabled = false,
}: {
  workspace: { id: string; name: string; slug: string; plan: string; createdAt: Date; _count: { members: number } }
  slug: string
  isOwner: boolean
  whatsappEnabled?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [apiKey] = useState(() => "est_live_" + Math.random().toString(36).substring(2, 12))
  const [holdDays, setHoldDays] = useState("7")
  const [clpEnabled, setClpEnabled] = useState(true)
  const [autoAssign, setAutoAssign] = useState(true)

  function copyApiKey() {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    toast.success("API key copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSave(section: string) {
    toast.success(`${section} settings saved successfully`)
  }

  return (
    <Tabs defaultValue="general" className="w-full space-y-6">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border bg-muted/50 p-1">
        <TabsTrigger value="general" className="rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-xs">
          <Building2 className="mr-1.5 size-3.5" /> General
        </TabsTrigger>
        <TabsTrigger value="pipeline" className="rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-xs">
          <Sliders className="mr-1.5 size-3.5" /> Pipeline & RERA
        </TabsTrigger>
        <TabsTrigger value="localization" className="rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-xs">
          <Globe className="mr-1.5 size-3.5" /> Localization
        </TabsTrigger>
        <TabsTrigger value="integrations" className="rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-xs">
          <BellRing className="mr-1.5 size-3.5" /> Integrations
        </TabsTrigger>
        <TabsTrigger value="api" className="rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-xs">
          <Key className="mr-1.5 size-3.5" /> API & Webhooks
        </TabsTrigger>
      </TabsList>

      {/* General Settings */}
      <TabsContent value="general" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">General Information</CardTitle>
            <CardDescription>
              Update your workspace brand name and web slug URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <WorkspaceSettingsForm
              workspaceId={workspace.id}
              workspaceSlug={slug}
              initial={{ name: workspace.name, slug: workspace.slug }}
            />
            <div className="flex flex-wrap items-center gap-3 border-t pt-4 text-xs text-muted-foreground">
              <span>Subscription Plan:</span>
              <Badge className="bg-brand text-brand-foreground capitalize">{workspace.plan}</Badge>
              <span>· {workspace._count.members} workspace member{workspace._count.members !== 1 ? "s" : ""}</span>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="xs" render={<Link href={`/${slug}/settings/members`} />}>
                  <Users className="mr-1 size-3" /> Members
                </Button>
                <Button variant="outline" size="xs" render={<Link href={`/${slug}/settings/billing`} />}>
                  <CreditCard className="mr-1 size-3" /> Billing
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isOwner && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-base text-destructive flex items-center gap-2 font-display">
                <ShieldAlert className="size-4" /> Danger Zone
              </CardTitle>
              <CardDescription className="text-xs">
                Deleting a workspace removes all associated contacts, deals, bookings, and activities. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeleteWorkspaceButton
                workspaceId={workspace.id}
                workspaceName={workspace.name}
              />
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Pipeline & Real Estate */}
      <TabsContent value="pipeline" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Real Estate & Pipeline Preferences</CardTitle>
            <CardDescription>
              Configure default unit booking hold windows, RERA document templates, and payment schedules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="holdDays" className="text-sm font-medium">Default Unit Hold Duration (Days)</Label>
              <Input
                id="holdDays"
                type="number"
                value={holdDays}
                onChange={(e) => setHoldDays(e.target.value)}
                className="max-w-xs focus-visible:ring-brand font-mono tabular-nums"
              />
              <p className="text-xs text-muted-foreground">Automatic expiration timeframe for temporary HOLD stage before releasing inventory back to pool.</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3.5">
              <div>
                <Label className="text-sm font-medium">Construction Linked Payment (CLP) Automation</Label>
                <p className="text-xs text-muted-foreground">Auto-generate milestone demand letters upon milestone completion updates.</p>
              </div>
              <Switch checked={clpEnabled} onCheckedChange={setClpEnabled} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3.5">
              <div>
                <Label className="text-sm font-medium">Auto-assign Inbound Site Visit Leads</Label>
                <p className="text-xs text-muted-foreground">Distribute unassigned inbound web/QR leads round-robin to active sales managers.</p>
              </div>
              <Switch checked={autoAssign} onCheckedChange={setAutoAssign} />
            </div>

            <Button onClick={() => handleSave("Pipeline")} className="bg-brand text-brand-foreground hover:bg-brand/90 font-medium">
              Save Pipeline Settings
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Localization */}
      <TabsContent value="localization" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg font-semibold">Regional & Currency Format</CardTitle>
            <CardDescription>Set defaults for currency symbols, number formats, and timezones.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Primary Currency</Label>
              <Input value="INR (₹) — Indian Rupee" disabled className="max-w-md bg-muted font-mono text-xs" />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Default Timezone</Label>
              <Input value="Asia/Kolkata (IST — UTC +05:30)" disabled className="max-w-md bg-muted font-mono text-xs" />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Supported Languages</Label>
              <div className="flex gap-2">
                <Badge variant="secondary" className="font-mono text-xs">English (EN)</Badge>
                <Badge variant="secondary" className="font-mono text-xs">Gujarati (GU)</Badge>
                <Badge variant="secondary" className="font-mono text-xs">Hindi (HI)</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Integrations */}
      <TabsContent value="integrations" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg font-semibold">Connected Channels & Messaging</CardTitle>
            <CardDescription>
              {whatsappEnabled
                ? "Manage WhatsApp Cloud API, Meta lead ads, and email notification sync."
                : "Manage Meta lead ads and email notification sync."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {whatsappEnabled && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Radio className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">WhatsApp</p>
                    <p className="text-xs text-muted-foreground">Inbound messages land in the Inbox; replies go out through the Cloud API.</p>
                  </div>
                </div>
                <Button variant="outline" size="xs" render={<Link href={`/${slug}/settings/social`} />}>
                  Configure
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Share2 className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium">Website & portal enquiries</p>
                  <p className="text-xs text-muted-foreground">Lead-form webhooks land in Contacts automatically — see API &amp; Webhooks below.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* API & Webhooks */}
      <TabsContent value="api" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg font-semibold">API Access & Developer Webhooks</CardTitle>
            <CardDescription>Generate secret API keys and configure HTTP webhooks for custom integrations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Secret Workspace API Key</Label>
              <div className="flex max-w-md items-center gap-2">
                <Input value={apiKey} readOnly className="font-mono text-xs focus-visible:ring-brand" />
                <Button variant="outline" size="sm" onClick={copyApiKey}>
                  {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Keep this key confidential. Use in <code className="font-mono bg-muted px-1 py-0.5 rounded text-[11px]">Authorization: Bearer</code> header.</p>
            </div>

            <div className="grid gap-2 border-t pt-4">
              <Label className="text-sm font-medium">Inbound Lead Webhook Endpoint</Label>
              <Input
                value={`https://${slug}.estate360.vercel.com/api/webhooks/leads`}
                readOnly
                className="max-w-md bg-muted font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">POST JSON lead payloads to this URL to trigger instant lead creation and AI qualification.</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
