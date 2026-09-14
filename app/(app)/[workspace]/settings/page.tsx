import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ExtendedSettingsTabs } from "@/components/settings/extended-settings-tabs"
import { Badge } from "@/components/ui/badge"
import { whatsappEnabled } from "@/modules/whatsapp/config"

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
    include: { _count: { select: { members: true } } },
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

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="rounded-2xl border bg-card p-5 md:p-6 relative overflow-hidden">
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold tracking-tight">Workspace Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage preferences, integrations, pipeline parameters, and security for {workspace.name.replace(/\.*$/, "")}.</p>
          </div>
          <Badge className="bg-brand text-brand-foreground capitalize">{workspace.plan} Plan</Badge>
        </div>
      </div>

      <ExtendedSettingsTabs workspace={workspace} slug={slug} isOwner={isOwner} whatsappEnabled={whatsappEnabled()} />
    </div>
  )
}
