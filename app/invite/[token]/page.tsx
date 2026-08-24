import type { Metadata } from "next"

import { AcceptInviteForm } from "@/components/auth/accept-invite-form"
import { SignupForm } from "@/components/auth/signup-form"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"

export const metadata: Metadata = { title: "Invite" }

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const session = await auth()

  const invite = await db.workspaceInvite.findUnique({
    where: { token },
    include: { workspace: { select: { name: true, slug: true } } },
  })

  if (!invite || invite.accepted || invite.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card>
          <CardHeader>
            <CardTitle>Invite unavailable</CardTitle>
            <CardDescription>
              This invite link is invalid or has expired. Ask a workspace admin
              for a new one.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="secondary">{invite.role}</Badge>
          </div>
          <CardTitle>You&apos;re invited to {invite.workspace.name}</CardTitle>
          <CardDescription>
            Invited for {invite.email} · expires {formatDate(invite.expiresAt)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {session?.user?.id ? (
            <AcceptInviteForm
              token={token}
              workspaceName={invite.workspace.name}
            />
          ) : (
            <SignupForm
              inviteToken={token}
              defaultWorkspaceName={invite.workspace.name}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
