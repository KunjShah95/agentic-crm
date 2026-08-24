import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { listOrganizations } from "@/modules/organizations/queries"
import { OrgsTable } from "@/components/organizations/orgs-table"
import { OrgFormDialog } from "@/components/organizations/org-form-dialog"

export const metadata: Metadata = { title: "Organizations" }

export default async function OrganizationsPage({
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

  const { items, total } = await listOrganizations(workspace.id)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            {total} compan{total !== 1 ? "ies" : "y"} in this workspace
          </p>
        </div>
        <OrgFormDialog workspaceId={workspace.id} />
      </div>

      <OrgsTable
        workspaceSlug={slug}
        workspaceId={workspace.id}
        orgs={items}
      />
    </div>
  )
}
