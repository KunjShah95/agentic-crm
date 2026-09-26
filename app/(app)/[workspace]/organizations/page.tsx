import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { listOrganizations } from "@/modules/organizations/queries"
import { OrgsTable } from "@/components/organizations/orgs-table"
import { OrgFormDialog } from "@/components/organizations/org-form-dialog"
import { PageHeader } from "@/components/shell/page-header"

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
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description={<>{total} compan{total !== 1 ? "ies" : "y"} · domain-matched contacts & deals</>}
        actions={<OrgFormDialog workspaceId={workspace.id} />}
      />

      <OrgsTable
        workspaceSlug={slug}
        workspaceId={workspace.id}
        orgs={items}
      />
    </div>
  )
}
