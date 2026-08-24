import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { UserPlus } from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { canInvite } from "@/lib/permissions"
import { MembersManager } from "@/components/settings/members-manager"
import { InviteForm } from "@/components/settings/invite-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = { title: "Members" }

export default async function MembersPage({
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
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: session.user.id,
          },
        },
      })
    : null
  if (!membership) notFound()

  const [members, invites] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    }),
    db.workspaceInvite.findMany({
      where: { workspaceId: workspace.id, accepted: false },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const canManage = canInvite(membership.role)

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-sm text-muted-foreground">
          {members.length} members · {invites.length} pending invite
          {invites.length !== 1 ? "s" : ""}
        </p>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="size-4" />
              Invite a teammate
            </CardTitle>
            <CardDescription>
              They&apos;ll receive a link to join this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm workspaceId={workspace.id} />
          </CardContent>
        </Card>
      )}

      <MembersManager
        workspaceId={workspace.id}
        members={members}
        invites={invites}
        currentUserId={session!.user!.id}
        canManage={canManage}
      />
    </div>
  )
}
