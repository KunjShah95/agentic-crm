import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Users, KanbanSquare, Building2, CalendarCheck, ArrowRight } from "lucide-react"

import { db } from "@/lib/db"
import { formatMoney, initials } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Metric, TableTotalsBar, TagPills, WinBar } from "@/components/ui/table-metrics"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()

  const [contacts, deals, projects, siteVisits, organizations, topDeals, recentActivities] =
    await Promise.all([
      db.contact.count({ where: { workspaceId: ws.id } }),
      db.deal.count({ where: { workspaceId: ws.id } }),
      db.project.count({ where: { workspaceId: ws.id } }),
      db.siteVisit.count({ where: { workspaceId: ws.id } }),
      db.organization.count({ where: { workspaceId: ws.id } }),
      db.deal.findMany({
        where: { workspaceId: ws.id },
        orderBy: [{ value: "desc" }, { updatedAt: "desc" }],
        take: 8,
        include: {
          stage: { select: { name: true, color: true } },
          owner: { select: { name: true } },
          organization: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true } },
          tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
        },
      }),
      db.activity.findMany({
        where: { workspaceId: ws.id },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, type: true, body: true, createdAt: true },
      }),
    ])

  const stats = [
    { label: "Contacts", value: contacts, icon: Users, href: `/${slug}/contacts` },
    { label: "Deals", value: deals, icon: KanbanSquare, href: `/${slug}/deals` },
    { label: "Projects", value: projects, icon: Building2, href: `/${slug}/projects` },
    { label: "Site visits", value: siteVisits, icon: CalendarCheck, href: `/${slug}/site-visits` },
    { label: "Organizations", value: organizations, icon: Building2, href: `/${slug}/organizations` },
  ]

  const sumPipeline = topDeals.reduce((s, d) => s + (d.value ?? 0), 0)
  const probs = topDeals.filter((d) => d.probability != null).map((d) => d.probability as number)
  const avgProb = probs.length
    ? Math.round(probs.reduce((s, p) => s + p, 0) / probs.length)
    : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-display font-semibold tracking-tight">
            Dashboard
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
            <Badge variant="secondary" className="rounded-md font-mono text-xs">{ws.name}</Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">A live overview of contacts, deals, projects, and site visits for this workspace.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="rounded-full gap-1.5" render={<Link href={`/${slug}/contacts`} />}>
            Go to contacts <ArrowRight className="size-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" render={<Link href={`/${slug}/reports`} />}>
            Reports
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <div className="group rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
              <div className="flex items-center gap-2 text-muted-foreground">
                <s.icon className="size-4" />
                <span className="font-mono text-[11px] tracking-[0.12em]">{s.label.toUpperCase()}</span>
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{s.value}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pipeline — reference-style data table */}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Top pipeline</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              by value
            </span>
          </div>
          <Link
            href={`/${slug}/deals?view=table`}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View all deals <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {topDeals.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No deals yet.</p>
        ) : (
          <>
            <Table>
              <TableHeader className="[&_th]:h-9 [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-muted-foreground">
                <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
                  <TableHead>Deal</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="hidden lg:table-cell">Owner</TableHead>
                  <TableHead className="hidden md:table-cell">Pipeline value</TableHead>
                  <TableHead className="hidden md:table-cell">Win probability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topDeals.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Link
                        href={`/${slug}/deals/${d.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {d.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {d.organization?.name ??
                          (d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : "—")}
                      </p>
                      <TagPills tags={d.tags} />
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: d.stage.color }}
                        />
                        {d.stage.name}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {d.owner ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Avatar className="size-5">
                            <AvatarFallback className="text-[9px]">
                              {initials(d.owner.name)}
                            </AvatarFallback>
                          </Avatar>
                          {d.owner.name}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden font-medium tabular-nums md:table-cell">
                      {formatMoney(d.value, d.currency)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <WinBar value={d.probability} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TableTotalsBar>
              <span className="font-medium">
                <span className="tabular-nums">{topDeals.length}</span>{" "}
                <span className="text-muted-foreground">deals in view</span>
              </span>
              <Metric label="Sum of pipeline" value={formatMoney(sumPipeline)} />
              <Metric label="Avg win probability" value={avgProb == null ? "—" : `${avgProb}%`} />
            </TableTotalsBar>
          </>
        )}
      </section>

      {/* Recent activity */}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">Recent activity</h2>
          <p className="text-xs text-muted-foreground">Across contacts and deals.</p>
        </div>
        <div className="space-y-2 p-4">
          {recentActivities.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
          {recentActivities.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2.5"
            >
              <Badge variant="outline" className="rounded-full font-mono text-[10px] shrink-0">
                {a.type}
              </Badge>
              <span className="text-xs text-muted-foreground truncate">{a.body || a.type}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
