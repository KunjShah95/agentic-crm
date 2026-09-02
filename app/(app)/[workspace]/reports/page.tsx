import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { getReportsSnapshot } from "@/modules/reports/queries"
import { buildReportsCsv, buildReportsHtml } from "@/modules/reports/export"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { TrendingUp, Building2, Wallet, Users, Target, Download, Printer } from "lucide-react"

export const metadata: Metadata = { title: "Reports" }

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>
  searchParams: Promise<{ format?: string; projectId?: string }>
}) {
  const { workspace: slug } = await params
  const { format, projectId } = await searchParams
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

  if (format === "csv") {
    const csv = buildReportsCsv(snapshot)
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="reports-${slug}.csv"`,
      },
    }) as unknown as React.ReactElement
  }
  if (format === "pdf") {
    const html = buildReportsHtml({
      ...snapshot,
      workspaceName: ws.name,
      generatedAt: new Date().toISOString(),
    })
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }) as unknown as React.ReactElement
  }

  const projects = await db.project.findMany({ where: { workspaceId: ws.id }, select: { id: true, name: true } })

  const funnelMax = Math.max(1, ...snapshot.funnel.map((r) => r.count))

  return (
    <div className="space-y-6">
      <div className="rounded-[20px] border bg-card p-5 md:p-6 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -right-16 h-48 w-64 rounded-full bg-gradient-to-br from-violet-500/10 via-blue-500/10 to-cyan-500/10 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight flex items-center gap-2">
              Reports <Badge variant="secondary" className="rounded-full">Phase 4.3</Badge>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Funnel · Inventory health · Collections · Source ROI · Team vs target — workspace-scoped, parity with Excel per project.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-full gap-1.5 shadow-sm" render={<Link href={`/${slug}/reports?format=csv${projectId ? `&projectId=${projectId}` : ""}`} />}>
              <Download className="size-3.5" /> Excel (CSV)
            </Button>
            <Button variant="outline" size="sm" className="rounded-full gap-1.5 shadow-sm" render={<Link href={`/${slug}/reports?format=pdf${projectId ? `&projectId=${projectId}` : ""}`} />}>
              <Printer className="size-3.5" /> PDF
            </Button>
          </div>
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-muted-foreground font-mono text-xs tracking-widest">FILTER PROJECT</span>
          <Link href={`/${slug}/reports`} className={`rounded-full border px-3 py-1 text-xs ${!projectId ? "bg-foreground text-background" : "bg-card"}`}>
            All projects
          </Link>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/${slug}/reports?projectId=${p.id}`}
              className={`rounded-full border px-3 py-1 text-xs ${projectId === p.id ? "bg-foreground text-background" : "bg-card"}`}
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
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-4 text-violet-600" /> Funnel</CardTitle>
            <CardDescription>INQUIRY → CLOSED · conversion % vs INQUIRY base</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.funnel.map((r) => (
              <div key={r.stage} className="grid grid-cols-[110px_1fr_64px_56px] items-center gap-2 text-sm">
                <span className="font-mono text-xs tracking-widest text-muted-foreground">{r.stage}</span>
                <Progress value={funnelMax ? (r.count / funnelMax) * 100 : 0} className="h-2" />
                <span className="text-right font-mono text-xs">{r.count}</span>
                <Badge variant="secondary" className="justify-center font-mono text-xs">{r.conversionPct}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Building2 className="size-4 text-emerald-600" /> Inventory Health</CardTitle>
            <CardDescription>AVAILABLE / HOLD / BOOKED / SOLD · sold% = (booked+sold)/total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-xl border bg-card p-3"><div className="text-xs text-muted-foreground">Avail</div><div className="text-lg font-semibold">{snapshot.inventory.available}</div></div>
              <div className="rounded-xl border bg-amber-50 p-3"><div className="text-xs text-muted-foreground">Hold</div><div className="text-lg font-semibold">{snapshot.inventory.hold}</div></div>
              <div className="rounded-xl border bg-blue-50 p-3"><div className="text-xs text-muted-foreground">Booked</div><div className="text-lg font-semibold">{snapshot.inventory.booked}</div></div>
              <div className="rounded-xl border bg-emerald-50 p-3"><div className="text-xs text-muted-foreground">Sold</div><div className="text-lg font-semibold">{snapshot.inventory.sold}</div></div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Progress value={snapshot.inventory.soldPct} className="h-2 flex-1" />
              <Badge className="rounded-full">{snapshot.inventory.soldPct}% sold</Badge>
              <span className="text-xs text-muted-foreground">{snapshot.inventory.total} units</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Wallet className="size-4 text-amber-600" /> Collections</CardTitle>
            <CardDescription>DUE / PAID / OVERDUE (past dueDate → OVERDUE) · overdue %</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border p-3"><div className="text-xs text-muted-foreground">Due</div><div className="font-mono font-medium">₹{snapshot.collections.due.toLocaleString("en-IN")}</div></div>
              <div className="rounded-xl border bg-emerald-50 p-3"><div className="text-xs text-muted-foreground">Paid</div><div className="font-mono font-medium">₹{snapshot.collections.paid.toLocaleString("en-IN")}</div></div>
              <div className="rounded-xl border bg-red-50 p-3"><div className="text-xs text-muted-foreground">Overdue</div><div className="font-mono font-medium">₹{snapshot.collections.overdue.toLocaleString("en-IN")}</div></div>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={snapshot.collections.overduePct} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">{snapshot.collections.overduePct}% overdue · total ₹{snapshot.collections.total.toLocaleString("en-IN")}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Users className="size-4 text-blue-600" /> Source ROI</CardTitle>
            <CardDescription>Leads / bookings / revenue by leadSource · sorted by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.sourceROI.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads yet.</p>
            ) : (
              <div className="space-y-2">
                {snapshot.sourceROI.map((r) => (
                  <div key={r.source} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div><div className="font-medium">{r.source}</div><div className="text-xs text-muted-foreground">{r.leads} leads · {r.bookings} bookings</div></div>
                    <div className="text-right"><div className="font-mono text-xs">₹{r.revenue.toLocaleString("en-IN")}</div><Badge variant="secondary" className="font-mono text-xs">{r.conversionPct}%</Badge></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Target className="size-4 text-violet-600" /> Team vs Target</CardTitle>
            <CardDescription>Bookings vs target (default 10, override via workspace settingsJson.targets)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.teamVsTarget.map((r) => (
              <div key={r.ownerId} className="rounded-lg border px-3 py-2">
                <div className="flex items-center justify-between text-sm"><span className="font-medium">{r.ownerName}</span><Badge variant={r.attainmentPct >= 100 ? "default" : "secondary"} className="font-mono text-xs">{r.attainmentPct}%</Badge></div>
                <div className="mt-1 flex items-center gap-2"><Progress value={Math.min(100, r.attainmentPct)} className="h-1.5 flex-1" /><span className="font-mono text-xs text-muted-foreground">{r.bookings}/{r.target}</span></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Separator />
      <p className="text-xs text-muted-foreground font-mono">Exports hit the same aggregators as this dashboard — Excel (CSV) and PDF match row-for-row per project filter. Browser print for PDF.</p>
    </div>
  )
}
