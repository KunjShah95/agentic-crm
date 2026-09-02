import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Building2, KanbanSquare, Search as SearchIcon, Users } from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { searchWorkspace, type SearchHit } from "@/modules/search/queries"
import { SearchInput } from "@/components/search/search-input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "Search" }

const TYPE_META = {
  contact: { label: "Contacts", icon: Users, href: "contacts" },
  organization: { label: "Organizations", icon: Building2, href: "organizations" },
  deal: { label: "Deals", icon: KanbanSquare, href: "deals" },
} as const

export default async function SearchPage({
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

  const q = typeof sp.q === "string" ? sp.q : ""
  const results = q ? await searchWorkspace(workspace.id, q) : []

  const grouped = new Map<SearchHit["type"], SearchHit[]>()
  for (const hit of results) {
    const list = grouped.get(hit.type) ?? []
    list.push(hit)
    grouped.set(hit.type, list)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[20px] border bg-card p-5 md:p-6 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -right-16 h-48 w-64 rounded-full bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-fuchsia-500/10 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        </div>
        <div className="relative">
          <h1 className="text-[22px] font-semibold tracking-tight">Search</h1>
          <p className="mt-1 text-sm text-muted-foreground">Workspace-wide Postgres full-text · tsvector + ts_rank · scoped by workspaceId</p>
        </div>
      </div>

      <SearchInput initialQuery={q} />

      {q && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-muted"><SearchIcon className="size-6 text-muted-foreground/50" /></span>
          <p className="mt-2 text-sm font-medium">No results for &ldquo;{q}&rdquo;</p>
          <p className="text-sm text-muted-foreground">Try a different name, email, or company. Use ⌘K anywhere.</p>
        </div>
      )}

      {q && results.length > 0 && (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
            <span className="font-medium text-foreground">“{q}”</span>
          </p>

          {(["contact", "organization", "deal"] as const).map((type) => {
            const hits = grouped.get(type) ?? []
            if (hits.length === 0) return null
            const meta = TYPE_META[type]
            return (
              <section key={type} className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <meta.icon className="size-4" />
                  {meta.label}
                  <Badge variant="secondary" className="text-[10px]">
                    {hits.length}
                  </Badge>
                </h2>
                <div className="overflow-hidden rounded-xl border bg-card">
                  {hits.map((hit, i) => (
                    <Link
                      key={`${type}-${hit.id}`}
                      href={`/${slug}/${meta.href}/${hit.id}`}
                      className={`group flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-muted/50 ${
                        i > 0 ? "border-t" : ""
                      }`}
                    >
                      <Avatar className="size-8">
                        <AvatarFallback className="text-[10px]">
                          {type === "organization"
                            ? hit.name.slice(0, 2).toUpperCase()
                            : hit.name
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((w) => w[0]?.toUpperCase())
                                .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{hit.name}</p>
                        {hit.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">
                            {hit.subtitle}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {!q && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-10 text-center">
          <p className="text-sm font-medium">Start typing</p><p className="mt-1 text-sm text-muted-foreground">Search across contacts, companies, and deals. Try <span className="rounded bg-foreground px-1.5 py-0.5 font-mono text-[11px] text-background">⌘K</span> for the palette.</p>
        </div>
      )}
    </div>
  )
}
