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
    <div className="space-y-6">
      <div className="rounded-[20px] border bg-card p-5 md:p-6 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -right-16 h-48 w-64 rounded-full bg-gradient-to-br from-violet-500/10 via-blue-500/10 to-cyan-500/10 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Contacts</h1>
            <p className="mt-1 text-sm text-muted-foreground">{data.total} contact{data.total !== 1 ? "s" : ""} · searchable, taggable, workspace-scoped</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1"><span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> {orgs.length} orgs</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-1">{members.length} members</span>
          </div>
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
