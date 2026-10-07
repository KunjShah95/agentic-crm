"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowUpRight,
  BellRing,
  Building2,
  CreditCard,
  Globe,
  Key,
  LoaderCircle,
  Radio,
  Share2,
  ShieldAlert,
  Sliders,
  Tag,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WorkspaceSettingsForm } from "@/components/settings/workspace-settings-form"
import { DeleteWorkspaceButton } from "@/components/settings/delete-workspace-button"
import { LeadIngestSettings } from "@/components/settings/lead-ingest-settings"
import { updatePipelineSettingsAction } from "@/lib/actions/settings"
import type { PipelineSettings } from "@/modules/workspace/pipeline-settings"

const SECTIONS = [
  { value: "general", label: "General", icon: Building2 },
  { value: "pipeline", label: "Pipeline & RERA", icon: Sliders },
  { value: "localization", label: "Localization", icon: Globe },
  { value: "integrations", label: "Integrations", icon: BellRing },
  { value: "api", label: "API & Webhooks", icon: Key },
] as const

/* One trigger style for every section. The primitive is Base UI, which marks
   the selected tab with `data-active` — the previous `data-[state=active]`
   selectors were Radix's and never matched, so the active tab was only
   distinguishable by the primitive's faint default. `!` is needed on the
   sizing utilities because the primitive's are orientation-variant-scoped and
   win on specificity otherwise. */
const triggerClass = cn(
  "h-9! flex-none! justify-start! gap-2 rounded-sm px-2.5 text-[13px] font-medium text-muted-foreground",
  "hover:bg-muted hover:text-foreground",
  "data-active:bg-card data-active:text-foreground data-active:shadow-none data-active:ring-1 data-active:ring-border",
  "md:w-full"
)

const navLinkClass =
  "flex h-9 shrink-0 items-center gap-2 rounded-sm px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:w-full"

/** A label/description on the left, its control on the right; stacks below `sm`. */
function SettingRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: string
  description?: React.ReactNode
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={htmlFor} className="text-[13px] font-medium">
          {title}
        </Label>
        {description ? <p className="text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-base font-semibold tracking-[-0.01em]">{title}</h2>
      <p className="text-[13px] text-muted-foreground">{description}</p>
    </div>
  )
}

export function ExtendedSettingsTabs({
  workspace,
  slug,
  isOwner,
  canManage,
  pipeline,
  whatsappEnabled = false,
}: {
  workspace: { id: string; name: string; slug: string; plan: string; createdAt: Date; _count: { members: number } }
  slug: string
  isOwner: boolean
  /** ADMIN or above: the pipeline action is ADMIN-gated on the server. */
  canManage: boolean
  pipeline: PipelineSettings
  whatsappEnabled?: boolean
}) {
  const router = useRouter()
  const [isSaving, startSaving] = useTransition()
  const [holdDays, setHoldDays] = useState(String(pipeline.holdDays))
  const [autoAssign, setAutoAssign] = useState(pipeline.autoAssign)
  const pipelineDirty = holdDays !== String(pipeline.holdDays) || autoAssign !== pipeline.autoAssign

  function savePipeline() {
    startSaving(async () => {
      const result = await updatePipelineSettingsAction(workspace.id, {
        holdDays: Number(holdDays),
        autoAssign,
      })
      if (result.error) {
        toast.error(result.error.message)
        return
      }
      toast.success("Pipeline settings saved")
      router.refresh()
    })
  }

  const memberCount = workspace._count.members

  const workspaceLinks = [
    { href: `/${slug}/settings/members`, label: "Members", icon: Users, meta: String(memberCount) },
    { href: `/${slug}/settings/billing`, label: "Billing", icon: CreditCard },
    { href: `/${slug}/settings/tags`, label: "Tags", icon: Tag },
    ...(whatsappEnabled ? [{ href: `/${slug}/settings/social`, label: "WhatsApp", icon: Radio }] : []),
  ]

  return (
    <Tabs
      defaultValue="general"
      orientation="vertical"
      className="flex! w-full flex-col! gap-6 md:flex-row! md:items-start md:gap-8"
    >
      {/* Section nav: a horizontally scrolling strip on phones, a sticky
          sidebar from `md`. Page links sit under the in-page sections so
          Members / Billing / Tags are reachable from the same place instead of
          hiding behind small buttons in the General card. */}
      <nav aria-label="Settings sections" className="min-w-0 md:sticky md:top-6 md:w-52 md:shrink-0">
        <TabsList
          className={cn(
            "h-auto! w-full flex-row! justify-start! gap-1 overflow-x-auto rounded-none bg-transparent p-0",
            "md:flex-col! md:items-stretch! md:overflow-visible"
          )}
        >
          {SECTIONS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className={triggerClass}>
              <Icon className="size-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4 hidden border-t pt-4 md:block">
          <p className="px-2.5 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Workspace</p>
          <div className="flex flex-col gap-1">
            {workspaceLinks.map(({ href, label, icon: Icon, meta }) => (
              <Link key={href} href={href} className={navLinkClass}>
                <Icon className="size-4" />
                <span className="flex-1">{label}</span>
                {meta ? <span className="text-xs tabular-nums">{meta}</span> : <ArrowUpRight className="size-3.5 opacity-60" />}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        {/* General */}
        <TabsContent value="general" className="space-y-6">
          <SectionHeading title="General" description="Your workspace name, URL and plan." />

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Workspace details</CardTitle>
              <CardDescription className="text-xs">Changing the slug changes every link to this workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <WorkspaceSettingsForm
                workspaceId={workspace.id}
                workspaceSlug={slug}
                initial={{ name: workspace.name, slug: workspace.slug }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="divide-y">
              <SettingRow title="Plan" description="Usage limits and invoices live on the billing page.">
                <div className="flex items-center gap-3">
                  <Badge className="bg-brand-solid text-brand-foreground">{workspace.plan}</Badge>
                  <Button variant="outline" size="sm" render={<Link href={`/${slug}/settings/billing`} />}>
                    Manage billing
                  </Button>
                </div>
              </SettingRow>
              <SettingRow
                title="Members"
                description={`${memberCount} member${memberCount !== 1 ? "s" : ""} in this workspace.`}
              >
                <Button variant="outline" size="sm" render={<Link href={`/${slug}/settings/members`} />}>
                  Manage members
                </Button>
              </SettingRow>
              <SettingRow title="Tags" description="Labels for organising contacts and deals.">
                <Button variant="outline" size="sm" render={<Link href={`/${slug}/settings/tags`} />}>
                  Manage tags
                </Button>
              </SettingRow>
            </CardContent>
          </Card>

          {isOwner && (
            <Card className="border-destructive/40">
              <CardHeader className="border-b border-destructive/20">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="size-4" /> Danger zone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SettingRow
                  title="Delete this workspace"
                  description="Removes all contacts, deals, bookings and activities. This cannot be undone."
                >
                  <DeleteWorkspaceButton workspaceId={workspace.id} workspaceName={workspace.name} />
                </SettingRow>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Pipeline & RERA. Every control here is persisted and read by
            something: holdDays by `holdUnit`, autoAssign by the lead-ingest
            worker. See modules/workspace/pipeline-settings.ts. */}
        <TabsContent value="pipeline" className="space-y-6">
          <SectionHeading
            title="Pipeline & RERA"
            description="How long unit holds last and who new leads go to."
          />

          <Card>
            <CardContent className="divide-y">
              <SettingRow
                title="Default unit hold"
                htmlFor="holdDays"
                description="How long a new hold lasts. The expiry shows on the unit and the deal; the unit is not released automatically."
              >
                <div className="flex items-center gap-2">
                  <Input
                    id="holdDays"
                    type="number"
                    min={1}
                    max={30}
                    value={holdDays}
                    disabled={!canManage || isSaving}
                    onChange={(e) => setHoldDays(e.target.value)}
                    className="w-20 tabular-nums"
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
              </SettingRow>
              <SettingRow
                title="Auto-assign incoming leads"
                htmlFor="autoAssign"
                description="Webhook and portal leads are shared round-robin across members. Off: they arrive unassigned for a manager to hand out."
              >
                <Switch
                  id="autoAssign"
                  checked={autoAssign}
                  disabled={!canManage || isSaving}
                  onCheckedChange={setAutoAssign}
                />
              </SettingRow>
              <SettingRow
                title="Payment schedule on booking"
                description="Confirming a booking always creates the CLP milestones and demand letter #1 from your DEMAND_LETTER template."
              >
                <Badge variant="secondary">Always on</Badge>
              </SettingRow>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {canManage ? (pipelineDirty ? "Unsaved changes" : "All changes saved") : "Only an owner or admin can change these."}
              </p>
              {canManage ? (
                <Button variant="brand" size="sm" onClick={savePipeline} disabled={!pipelineDirty || isSaving}>
                  {isSaving ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                  Save pipeline settings
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Localization */}
        <TabsContent value="localization" className="space-y-6">
          <SectionHeading title="Localization" description="Currency, timezone and language defaults." />

          <Card>
            <CardContent className="divide-y">
              <SettingRow title="Primary currency" description="Used for prices, deal values and invoices.">
                <span className="text-[13px] font-medium">INR (₹) — Indian Rupee</span>
              </SettingRow>
              <SettingRow title="Timezone" description="Used for reminders, site visits and reports.">
                <span className="text-[13px] font-medium">Asia/Kolkata (UTC +05:30)</span>
              </SettingRow>
              <SettingRow title="Languages" description="Languages available for templates and messages.">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">English</Badge>
                  <Badge variant="secondary">Gujarati</Badge>
                  <Badge variant="secondary">Hindi</Badge>
                </div>
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-6">
          <SectionHeading
            title="Integrations"
            description={
              whatsappEnabled
                ? "WhatsApp Cloud API, portal enquiries and lead ads."
                : "Portal enquiries and lead ads."
            }
          />

          <Card>
            <CardContent className="divide-y">
              {whatsappEnabled && (
                <IntegrationRow
                  icon={<Radio className="size-4.5" />}
                  tone="bg-status-positive-bg text-status-positive-fg"
                  title="WhatsApp"
                  description="Inbound messages land in the Inbox; replies go out through the Cloud API."
                >
                  <Button variant="outline" size="sm" render={<Link href={`/${slug}/settings/social`} />}>
                    Configure
                  </Button>
                </IntegrationRow>
              )}
              <IntegrationRow
                icon={<Share2 className="size-4.5" />}
                tone="bg-status-info-bg text-status-info-fg"
                title="Website & portal enquiries"
                description="Lead-form webhooks land in Contacts automatically."
              >
                <Badge variant="secondary">Via webhook</Badge>
              </IntegrationRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API & Webhooks */}
        <TabsContent value="api" className="space-y-6">
          <SectionHeading
            title="API & Webhooks"
            description="Authenticate lead webhooks from portals, ad platforms and your website."
          />
          {/* LeadIngestSettings uses the real ADMIN-gated server actions and
              shows the secret exactly once. */}
          <LeadIngestSettings workspaceId={workspace.id} workspaceSlug={slug} canManage={canManage} />
        </TabsContent>
      </div>
    </Tabs>
  )
}

function IntegrationRow({
  icon,
  tone,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  tone: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-sm", tone)}>{icon}</span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
