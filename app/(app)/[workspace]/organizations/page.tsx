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
      <div className="rounded-[20px] border bg-card p-5 md:p-6 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -right-16 h-48 w-64 rounded-full bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-cyan-500/10 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        </div>
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
