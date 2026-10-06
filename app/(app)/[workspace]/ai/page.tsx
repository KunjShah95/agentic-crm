import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { brokerScopeFilter, resolveViewerScope } from "@/lib/permissions"
import { getReportsSnapshot } from "@/modules/reports/queries"
import { revenueForecast, collectionForecast, dealFunnel, topDeals, collectionsTimeline } from "@/modules/ai/forecast"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { askPipeline } from "@/modules/ai/ask"
import { PageHeader } from "@/components/shell/page-header"
import { Sparkles, TrendingUp, Wallet, Bot } from "lucide-react"

export default async function AIPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { workspace: slug } = await params
  const { q } = await searchParams
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()
  const session = await auth()
  // Every other page in this app gates on membership with notFound(). This one
  // did not, so a non-member who guessed a valid workspace slug rendered the
  // Intelligence page and the workspace-wide forecast below it. The broker
  // scope doubles as the membership proof.
  const scope =
    session?.user?.id ? await resolveViewerScope(ws.id, session.user.id) : null
  if (!scope) notFound()

  // forecast data — scoped, because these two queries are the numbers the page
  // headlines. An unscoped read here does not look like a bug: a broker seeing
  // the whole tenant's revenue is indistinguishable from a big month.
  const dealScope = brokerScopeFilter(scope.role, scope.brokerId)
  const [deals, payments] = await Promise.all([
    db.deal.findMany({ where: { workspaceId: ws.id, ...dealScope }, select: { id: true, title: true, bookingStage: true, value: true } }),
    db.payment.findMany({
      where: { workspaceId: ws.id, deal: { workspaceId: ws.id, ...dealScope } },
      select: { id: true, status: true, amount: true, dueDate: true, deal: { select: { title: true } } },
    }),
  ])
  const rev = revenueForecast(deals)
  const coll = collectionForecast(payments)
  const funnel = dealFunnel(deals)
  const top = topDeals(deals)
  const timeline = collectionsTimeline(
    payments.map((p) => ({ ...p, dealTitle: p.deal.title })),
  )
  const snapshot = await getReportsSnapshot(scope, { projectId: undefined })

  const askResult = q ? await askPipeline(scope, q) : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={<><Bot className="size-6 text-brand" /> Intelligence</>}
        description="Revenue and collections forecasts, next-best-actions, and a read-only assistant for your pipeline."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="size-4 text-brand" /> Revenue forecast</CardTitle>
            <CardDescription>Weighted by stage probability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-display text-[28px] font-medium tracking-[-0.02em] tabular-nums">₹{rev.weighted.toLocaleString("en-IN")}</div>
            <div className="text-xs text-muted-foreground tabular-nums">Pipeline ₹{rev.pipeline.toLocaleString("en-IN")} · {rev.count} deals</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Wallet className="size-4 text-brand" /> Collections</CardTitle>
            <CardDescription>Due in 30d vs overdue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-display text-[28px] font-medium tracking-[-0.02em] tabular-nums text-destructive">₹{coll.overdue.toLocaleString("en-IN")} overdue</div>
            <div className="text-xs text-muted-foreground tabular-nums">Due 30d ₹{coll.due30.toLocaleString("en-IN")} · next {coll.nextDueDate ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4 text-brand" /> Funnel snapshot</CardTitle>
            <CardDescription>{snapshot.funnel[0]?.count ?? 0} enquiries · {snapshot.inventory.total} units</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex flex-wrap gap-1">
              {snapshot.funnel.slice(0, 4).map((r) => (
                <Badge key={r.stage} variant="secondary" className="text-xs tabular-nums">{r.stage}: {r.count}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="size-4 text-brand" /> Deal Funnel</CardTitle>
            <CardDescription>Deals by stage with weighted value</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnel.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals in pipeline.</p>
            ) : (
              funnel.map((row) => {
                const maxWeighted = Math.max(...funnel.map((r) => r.weighted), 1)
                const pct = Math.round((row.weighted / maxWeighted) * 100)
                return (
                  <div key={row.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{row.stage}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {row.count} deal{row.count !== 1 ? "s" : ""} · ₹{row.pipeline.toLocaleString("en-IN")} · weighted ₹{row.weighted.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="size-4 text-brand" /> Top Deals</CardTitle>
            <CardDescription>Top 5 by weighted value</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals in pipeline.</p>
            ) : (
              top.map((deal, i) => (
                <div key={deal.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{deal.title}</div>
                      <div className="text-xs text-muted-foreground">{deal.stage}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-medium tabular-nums">₹{deal.weighted.toLocaleString("en-IN")}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">₹{deal.value.toLocaleString("en-IN")}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Wallet className="size-4 text-brand" /> Collections Timeline</CardTitle>
          <CardDescription>Upcoming due dates (next 30 days)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming collections in the next 30 days.</p>
          ) : (
            timeline.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{entry.dealTitle ?? "Payment"}</div>
                  <div className="text-xs text-muted-foreground">{entry.dueDate}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-medium tabular-nums">₹{entry.amount.toLocaleString("en-IN")}</div>
                  <Badge variant={entry.status === "OVERDUE" ? "destructive" : "secondary"} className="text-[10px]">
                    {entry.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bot className="size-4 text-brand" /> Ask your pipeline</CardTitle>
          <CardDescription>Try “show funnel”, “overdue payments”, “recent deals”, “recent contacts”, “inventory by status”.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex gap-2">
            <Input name="q" defaultValue={q ?? ""} placeholder="Ask — e.g. overdue payments" className="flex-1 focus-visible:ring-brand" />
            <Button type="submit" variant="brand" className="rounded-sm">Ask</Button>
          </form>
          {askResult ? (
            <div className="rounded-md border bg-muted/30 p-4 space-y-2">
              <div className="text-sm font-medium">{askResult.answer}</div>
              {askResult.rows && askResult.rows.length > 0 ? (
                <div className="text-xs bg-card rounded-md border p-3 overflow-auto max-h-64">
                  <pre>{JSON.stringify(askResult.rows.slice(0, 20), null, 2)}</pre>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Read-only — the assistant answers from your workspace data, nothing leaves it.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What the assistant can do</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <div>• <span className="font-medium text-foreground">Suggested next actions</span> — ranked call, WhatsApp, or site-visit follow-ups for the deals that are going quiet.</div>
          <div>• <span className="font-medium text-foreground">Follow-up cadence</span> — hot, warm, and cold leads get automatic check-in tasks on your team&apos;s timeline.</div>
          <div>• <span className="font-medium text-foreground">Message drafts</span> — ready-to-send WhatsApp and email replies you approve before anything goes out.</div>
          <div>• <span className="font-medium text-foreground">Call analysis</span> — pull budget, unit preference, and intent out of call notes.</div>
        </CardContent>
      </Card>
    </div>
  )
}
