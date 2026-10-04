import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { resolveViewerScope } from "@/lib/permissions"
import { listContacts, type ContactFilters } from "@/modules/contacts/queries"
import { ContactsTable } from "@/components/contacts/contacts-table"
import { PageHeader } from "@/components/shell/page-header"

export const metadata: Metadata = { title: "Contacts" }

const SORTS = new Set(["newest", "oldest", "name", "updated"])

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { workspace: slug } = await params
  const sp = await searchParams
  const session = await auth()

  const workspace = await db.workspace.findUnique({ where: { slug } })
  if (!workspace) notFound()

  const scope =
    session?.user?.id ? await resolveViewerScope(workspace.id, session.user.id) : null
  if (!scope) notFound()

  const str = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined

  const filters: ContactFilters = {
    q: str(sp.q),
    tagId: str(sp.tag),
    organizationId: str(sp.org),
    ownerId: str(sp.owner),
    sort: SORTS.has(str(sp.sort) ?? "") ? (str(sp.sort) as ContactFilters["sort"]) : "newest",
    page: Number(str(sp.page)) || 1,
  }

  const [data, tags, orgs, members] = await Promise.all([
    listContacts(scope, filters),
    db.tag.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    db.organization.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description={<>{data.total} contact{data.total !== 1 ? "s" : ""} · find, filter, and manage your leads</>}
        actions={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1"><span className="size-2 rounded-full bg-status-positive-fg" /> {orgs.length} orgs</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1">{members.length} members</span>
          </div>
        }
      />

      <ContactsTable
        workspaceSlug={slug}
        workspaceId={workspace.id}
        role={scope.role}
        data={data}
        filters={filters}
        tags={tags}
        orgs={orgs}
        members={members}
      />
    </div>
  )
}
