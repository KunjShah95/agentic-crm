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
    <div className="space-y-6">
      <div className="rounded-md border bg-card p-5 md:p-6">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Organizations</h1>
            <p className="mt-1 text-sm text-muted-foreground">{total} compan{total !== 1 ? "ies" : "y"} · domain-matched contacts & deals</p>
          </div>
          <OrgFormDialog workspaceId={workspace.id} />
        </div>
      </div>

      <OrgsTable
        workspaceSlug={slug}
        workspaceId={workspace.id}
        orgs={items}
      />
    </div>
  )
}
