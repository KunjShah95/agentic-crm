import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { TagManager } from "@/components/settings/tag-manager"
import { PageHeader } from "@/components/shell/page-header"

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
      {/*
        The one h1 on this screen, via the shared primitive. It previously
        hand-rolled its own header at a different size, tracking and leading
        from every other page in the app — which is exactly what a `PageHeader`
        exists to prevent.
      */}
      <PageHeader
        title="Manage tags"
        description={`Create, edit, and delete tags used across contacts and deals in ${workspace.name}.`}
      />
      <TagManager workspaceId={workspace.id} initialTags={tags} />
    </div>
  )
}
