import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { TagManager } from "@/components/settings/tag-manager"

export const metadata: Metadata = { title: "Manage Tags" }

export default async function TagsSettingsPage({
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

  const tags = await db.tag.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      _count: { select: { contacts: true, deals: true } },
    },
  })

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-display font-semibold tracking-tight">Manage Tags</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create, edit, and delete tags used across contacts and deals in {workspace.name}.
        </p>
      </div>
      <TagManager workspaceId={workspace.id} initialTags={tags} />
    </div>
  )
}
