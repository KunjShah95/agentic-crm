import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { KanbanSquare, Table as TableIcon } from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"
import {
  getPipeline,
  listDealsForTable,
  pipelineStats,
} from "@/modules/deals/queries"
import { listWorkspaceMembers } from "@/modules/contacts/queries"
import { formatMoney } from "@/lib/format"
import { KanbanBoard } from "@/components/deals/kanban-board"
import { DealsTable } from "@/components/deals/deals-table"
import { DealFormDialog } from "@/components/deals/deal-form-dialog"
import { StageManager } from "@/components/deals/stage-manager"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = { title: "Deals" }

export default async function DealsPage({
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

  const view = sp.view === "table" ? "table" : "kanban"

  const [pipeline, tableDeals, members, contacts, orgs, stats] =
    await Promise.all([
      getPipeline(workspace.id),
      view === "table" ? listDealsForTable(workspace.id) : null,
      listWorkspaceMembers(workspace.id),
      db.contact.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true, lastName: true },
      }),
      db.organization.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      pipelineStats(workspace.id),
    ])

  const users = new Map(members.map((m) => [m.user.id, { name: m.user.name }]))

  const statCards = [
    { label: "Total pipeline", value: formatMoney(stats.total) },
    { label: "Weighted forecast", value: formatMoney(stats.weighted) },
    { label: "Won", value: formatMoney(stats.won) },
    { label: "Open deals", value: String(stats.count) },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-[20px] border bg-card p-5 md:p-6 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -right-16 h-64 w-72 rounded-full bg-gradient-to-br from-violet-500/10 via-blue-500/10 to-cyan-500/10 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Deals</h1>
            <p className="mt-1 text-sm text-muted-foreground">{pipeline.stages.length} stages · {pipeline.deals.length} deals · drag to log, no admin hour</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border bg-muted/40 p-0.5">
              <Link
                href={`/${slug}/deals`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  view === "kanban"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <KanbanSquare className="size-4" />
                Board
              </Link>
              <Link
                href={`/${slug}/deals?view=table`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  view === "table"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <TableIcon className="size-4" />
                Table
              </Link>
            </div>
            <StageManager workspaceId={workspace.id} stages={pipeline.stages} />
            <DealFormDialog
              workspaceId={workspace.id}
              stages={pipeline.stages}
              contacts={contacts}
              organizations={orgs}
              members={members}
            />
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="bg-muted/30 border-dashed">
              <CardContent className="flex flex-col gap-0.5 py-3">
                <span className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{stat.label}</span>
                <span className="text-lg font-semibold tracking-tight">
                  {stat.value}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {view === "kanban" ? (
        <KanbanBoard
          workspaceSlug={slug}
          workspaceId={workspace.id}
          stages={pipeline.stages}
          deals={pipeline.deals}
          users={users}
        />
      ) : (
        <DealsTable
          workspaceSlug={slug}
          workspaceId={workspace.id}
          deals={tableDeals ?? []}
          stages={pipeline.stages}
          contacts={contacts}
          organizations={orgs}
          members={members}
        />
      )}
    </div>
  )
}
