import type { Metadata } from "next"
import { Fragment } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { KanbanSquare, Table as TableIcon } from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { brokerContactScope, resolveViewerScope } from "@/lib/permissions"
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
import { CompanyTakeCard } from "@/components/deals/company-take-card"
import { StageManager } from "@/components/deals/stage-manager"
import { PageHeader, Stat } from "@/components/shell/page-header"

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

  const scope =
    session?.user?.id ? await resolveViewerScope(workspace.id, session.user.id) : null
  if (!scope) notFound()

  const view = sp.view === "table" ? "table" : "kanban"

  const [pipeline, tableDeals, members, contacts, orgs, stats, tags] =
    await Promise.all([
      getPipeline(scope),
      view === "table" ? listDealsForTable(scope) : null,
      listWorkspaceMembers(workspace.id),
      // Scoped for the same reason the tables are: this feeds the deal form's
      // contact picker, and an unscoped list lets a broker pick any contact in
      // the tenant and attach one of their deals to it.
      db.contact.findMany({
        where: { workspaceId: workspace.id, ...brokerContactScope(scope.role, scope.brokerId) },
        orderBy: { firstName: "asc" },
        select: { id: true, firstName: true, lastName: true },
      }),
      db.organization.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      pipelineStats(scope),
      db.tag.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, color: true },
      }),
    ])

  const users = new Map(members.map((m) => [m.user.id, { name: m.user.name }]))

  const statCards = [
    { label: "Total pipeline", value: formatMoney(stats.total) },
    { label: "Won", value: formatMoney(stats.won) },
    { label: "Open deals", value: String(stats.count) },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deals"
        description={<>{pipeline.deals.length} deal{pipeline.deals.length !== 1 ? "s" : ""} across {pipeline.stages.length} stage{pipeline.stages.length !== 1 ? "s" : ""} · drag to update status</>}
        actions={
          <>
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
          </>
        }
        stats={
          <>
            {statCards.map((stat) => (
              <Fragment key={stat.label}>
                <Stat label={stat.label} value={stat.value} />
                {stat.label === "Won" && <CompanyTakeCard take={stats.take} />}
              </Fragment>
            ))}
          </>
        }
      />

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
          tags={tags}
        />
      )}
    </div>
  )
}
