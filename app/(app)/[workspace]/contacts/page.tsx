import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { listContacts, type ContactFilters } from "@/modules/contacts/queries"
import { ContactsTable } from "@/components/contacts/contacts-table"

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
    listContacts(workspace.id, filters),
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {data.total} contact{data.total !== 1 ? "s" : ""} in this workspace
          </p>
        </div>
      </div>

      <ContactsTable
        workspaceSlug={slug}
        workspaceId={workspace.id}
        role={membership.role}
        data={data}
        filters={filters}
        tags={tags}
        orgs={orgs}
        members={members}
      />
    </div>
  )
}
