import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ExtendedSettingsTabs } from "@/components/settings/extended-settings-tabs"
import { PageHeader } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { whatsappEnabled } from "@/modules/whatsapp/config"
import { hasMinRole } from "@/lib/permissions"
import { readPipelineSettings } from "@/modules/workspace/pipeline-settings"
import { PLAN_LABELS, resolveEffectivePlan } from "@/modules/billing/limits"

export const metadata: Metadata = { title: "Workspace settings" }

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>
}) {
  const { workspace: slug } = await params
  const session = await auth()

  const workspace = await db.workspace.findUnique({
    where: { slug },
    include: { _count: { select: { members: true } }, subscription: true },
  })
  if (!workspace) notFound()

  const membership = session?.user?.id
    ? await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: session.user.id,
          },
        },
      })
    : null
  if (!membership) notFound()

  const isOwner = membership.role === "OWNER"
  const canManage = hasMinRole(membership.role, "ADMIN")
  const pipeline = readPipelineSettings(workspace.settingsJson)
  // The plan in force (trial-aware), not the raw stored value: a trialling
  // workspace stores "free" but runs on Team limits.
  const effective = resolveEffectivePlan(workspace, workspace.subscription)
  const planLabel = effective.trialEndsAt ? `${PLAN_LABELS[effective.plan]} trial` : PLAN_LABELS[effective.plan]

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Workspace Settings"
        description={<>Manage preferences, integrations, pipeline parameters, and security for {workspace.name.replace(/\.*$/, "")}.</>}
        badge={<Badge className="bg-brand-solid text-brand-foreground">{planLabel}</Badge>}
      />

      {/* Picked, not spread: the full row carries `settingsJson`, which holds
          the ingest secret hash and API key hashes, and anything handed to a
          client component is serialized into the page payload. */}
      <ExtendedSettingsTabs
        workspace={{
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: planLabel,
          createdAt: workspace.createdAt,
          _count: workspace._count,
        }}
        slug={slug}
        isOwner={isOwner}
        canManage={canManage}
        pipeline={pipeline}
        whatsappEnabled={whatsappEnabled()}
      />
    </div>
  )
}
