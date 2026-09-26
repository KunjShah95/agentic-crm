import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { getReportsSnapshot } from "@/modules/reports/queries"
import { ExportButtons } from "@/components/reports/export-buttons"
import { PageHeader } from "@/components/shell/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { TrendingUp, Building2, Wallet, Users, Target, BarChart3, PieChart, Trophy } from "lucide-react"

export const metadata: Metadata = { title: "Reports" }

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>
  searchParams: Promise<{ format?: string; projectId?: string }>
}) {
  const { workspace: slug } = await params
  const { projectId } = await searchParams
  const session = await auth()
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()

  const membership = session?.user?.id
    ? await db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: ws.id, userId: session.user.id } },
      })
    : null

  const snapshot = await getReportsSnapshot(ws.id, {
    projectId: projectId ?? undefined,
    role: (membership?.role as never) ?? undefined,
  })

  const projects = await db.project.findMany({ where: { workspaceId: ws.id }, select: { id: true, name: true } })

  const funnelMax = Math.max(1, ...snapshot.funnel.map((r) => r.count))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Funnel, inventory health, collections, source ROI, and team targets — filter by project."
        actions={<ExportButtons slug={slug} projectId={projectId} />}
      />

      {projects.length > 0 ? (
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-muted-foreground text-[11px] tracking-wider uppercase">Filter Project</span>
          <Link href={`/${slug}/reports`} className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${!projectId ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
            All projects
          </Link>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/${slug}/reports?projectId=${p.id}`}
              className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${projectId === p.id ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      ) : null}

      {/* Stats bento */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-display"><TrendingUp className="size-4 text-brand" /> Funnel</CardTitle>
            <CardDescription>Every stage from enquiry to close, with conversion against enquiries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.funnel.map((r) => (
              <div key={r.stage} className="grid grid-cols-[110px_1fr_64px_56px] items-center gap-2 text-sm">
                <span className="text-xs tracking-wider text-muted-foreground">{r.stage}</span>
                <Progress value={funnelMax ? (r.count / funnelMax) * 100 : 0} className="h-2" />
                <span className="text-right text-xs tabular-nums">{r.count}</span>
                <Badge variant="secondary" className="justify-center text-xs tabular-nums">{r.conversionPct}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-display"><Building2 className="size-4 text-status-positive-fg" /> Inventory Health</CardTitle>
            <CardDescription>Units available, on hold, booked, and sold across projects.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-md border bg-card p-2.5"><div className="text-xs text-muted-foreground">Avail</div><div className="text-lg font-semibold tabular-nums">{snapshot.inventory.available}</div></div>
              <div className="rounded-md border bg-status-caution-bg text-status-caution-fg p-2.5"><div className="text-xs opacity-80">Hold</div><div className="text-lg font-semibold tabular-nums">{snapshot.inventory.hold}</div></div>
              <div className="rounded-md border bg-status-info-bg text-status-info-fg p-2.5"><div className="text-xs opacity-80">Booked</div><div className="text-lg font-semibold tabular-nums">{snapshot.inventory.booked}</div></div>
              <div className="rounded-md border bg-status-positive-bg text-status-positive-fg p-2.5"><div className="text-xs opacity-80">Sold</div><div className="text-lg font-semibold tabular-nums">{snapshot.inventory.sold}</div></div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Progress value={snapshot.inventory.soldPct} className="h-2 flex-1" />
              <Badge className="rounded-md text-xs tabular-nums">{snapshot.inventory.soldPct}% sold</Badge>
              <span className="text-xs text-muted-foreground tabular-nums">{snapshot.inventory.total} units</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-display"><Wallet className="size-4 text-brand" /> Collections</CardTitle>
            <CardDescription>Milestones due, collected, and past their due date.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border p-2.5"><div className="text-xs text-muted-foreground">Due</div><div className="font-semibold tabular-nums">₹{snapshot.collections.due.toLocaleString("en-IN")}</div></div>
              <div className="rounded-md border bg-status-positive-bg text-status-positive-fg p-2.5"><div className="text-xs opacity-80">Paid</div><div className="font-semibold tabular-nums">₹{snapshot.collections.paid.toLocaleString("en-IN")}</div></div>
              <div className="rounded-md border bg-destructive/10 text-destructive p-2.5"><div className="text-xs opacity-80">Overdue</div><div className="font-semibold tabular-nums">₹{snapshot.collections.overdue.toLocaleString("en-IN")}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={snapshot.collections.overduePct} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground tabular-nums">{snapshot.collections.overduePct}% overdue · total ₹{snapshot.collections.total.toLocaleString("en-IN")}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-display"><Users className="size-4 text-status-info-fg" /> Source ROI</CardTitle>
            <CardDescription>Leads, bookings, and revenue by where they came from.</CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.sourceROI.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads yet.</p>
            ) : (
              <div className="space-y-2">
                {snapshot.sourceROI.map((r) => (
                  <div key={r.source} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div><div className="font-medium">{r.source === "UNKNOWN" ? "Not recorded" : r.source}</div><div className="text-xs text-muted-foreground tabular-nums">{r.leads} leads · {r.bookings} bookings</div></div>
                    <div className="text-right"><div className="text-xs font-semibold tabular-nums">₹{r.revenue.toLocaleString("en-IN")}</div><Badge variant="secondary" className="text-xs tabular-nums">{r.conversionPct}%</Badge></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-display"><Target className="size-4 text-brand" /> Team vs Target</CardTitle>
            <CardDescription>Bookings per owner against their monthly target.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.teamVsTarget.map((r) => (
              <div key={r.ownerId} className="rounded-md border px-3 py-2">
                <div className="flex items-center justify-between text-sm"><span className="font-medium">{r.ownerName}</span><Badge variant={r.attainmentPct >= 100 ? "default" : "secondary"} className="text-xs tabular-nums">{r.attainmentPct}%</Badge></div>
                <div className="mt-1 flex items-center gap-2"><Progress value={Math.min(100, r.attainmentPct)} className="h-1.5 flex-1" /><span className="text-xs tabular-nums text-muted-foreground">{r.bookings}/{r.target}</span></div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pipeline by Stage */}
        <Card className="lg:col-span-6">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-display"><BarChart3 className="size-4 text-status-info-fg" /> Pipeline by Stage</CardTitle>
            <CardDescription>Deal count and value across pipeline stages.</CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.pipelineByStage.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stages configured.</p>
            ) : (
              <div className="space-y-3">
                {snapshot.pipelineByStage.map((r) => {
                  const maxValue = Math.max(1, ...snapshot.pipelineByStage.map((s) => s.value))
                  return (
                    <div key={r.stageId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ backgroundColor: r.color }} />
                          {r.name}
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">{r.count} deals · ₹{r.value.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${maxValue > 0 ? (r.value / maxValue) * 100 : 0}%`, backgroundColor: r.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deals by Owner */}
        <Card className="lg:col-span-6">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-display"><PieChart className="size-4 text-status-positive-fg" /> Deals by Owner</CardTitle>
            <CardDescription>Distribution of deals across team members.</CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.dealsByOwner.length === 0 ? (
              <p className="text-sm text-muted-foreground">No team members.</p>
            ) : (
              <div className="space-y-2">
                {snapshot.dealsByOwner.map((r) => {
                  const totalDeals = snapshot.dealsByOwner.reduce((sum, o) => sum + o.count, 0)
                  const pct = totalDeals > 0 ? Math.round((r.count / totalDeals) * 100) : 0
                  return (
                    <div key={r.ownerId} className="flex items-center gap-3 rounded-md border px-3 py-2">
                      <span className="size-3 rounded-full" style={{ backgroundColor: r.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{r.name}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">{r.count} deals · ₹{r.value.toLocaleString("en-IN")}</div>
                      </div>
                      <Badge variant="secondary" className="text-xs tabular-nums">{pct}%</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Win Rate by Deal Type */}
        <Card className="lg:col-span-12">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-display"><Trophy className="size-4 text-status-caution-fg" /> Win Rate by Deal Type</CardTitle>
            <CardDescription>Conversion rate across different property types.</CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.winRateByType.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4 text-right">Total</th>
                      <th className="pb-2 pr-4 text-right">Won</th>
                      <th className="pb-2 text-right">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.winRateByType.map((r) => (
                      <tr key={r.type} className="border-b last:border-0">
                        <td className="py-2.5 pr-4 font-medium">{r.type === "UNCLASSIFIED" ? "Unclassified" : r.type}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">{r.total}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">{r.won}</td>
                        <td className="py-2.5 text-right">
                          <Badge variant={r.winRate >= 50 ? "default" : "secondary"} className="text-xs tabular-nums">
                            {r.winRate}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />
    </div>
  )
}
