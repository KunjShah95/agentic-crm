import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Users } from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatDate } from "@/lib/format"
import { WorkspaceSettingsForm } from "@/components/settings/workspace-settings-form"
import { DeleteWorkspaceButton } from "@/components/settings/delete-workspace-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="rounded-[20px] border bg-card p-5 md:p-6 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -right-16 h-48 w-64 rounded-full bg-gradient-to-br from-slate-500/10 via-violet-500/10 to-blue-500/10 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-500/20 to-transparent" />
        </div>
        <div className="relative">
          <h1 className="text-[22px] font-semibold tracking-tight">Workspace settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage {workspace.name} · {workspace.slug} · {workspace._count.members} members</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            Name, URL slug, and plan. Created {formatDate(workspace.createdAt)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <WorkspaceSettingsForm
            workspaceId={workspace.id}
            workspaceSlug={slug}
            initial={{ name: workspace.name, slug: workspace.slug }}
          />
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <span className="text-sm text-muted-foreground">Plan</span>
            <Badge className="capitalize">{workspace.plan}</Badge>
            <span className="text-sm text-muted-foreground">
              · {workspace._count.members} member
              {workspace._count.members !== 1 ? "s" : ""}
            </span>
            <Button
              variant="link"
              size="sm"
              className="ml-auto"
              render={<Link href={`/${slug}/settings/members`} />}
            >
              <Users data-icon="inline-start" />
              Manage members
            </Button>
          </div>
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Deleting a workspace removes every contact, deal, and activity in
              it. This cannot be undone.
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
    </div>
  )
}
