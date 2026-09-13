import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { getReportsSnapshot } from "@/modules/reports/queries"
import { revenueForecast, collectionForecast } from "@/modules/ai/forecast"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { askPipeline } from "@/modules/ai/ask"
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
  const membership = session?.user?.id
    ? await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId: session.user.id } } })
    : null

  // forecast data
  const deals = await db.deal.findMany({ where: { workspaceId: ws.id }, select: { bookingStage: true, value: true } })
  const payments = await db.payment.findMany({ where: { workspaceId: ws.id }, select: { status: true, amount: true, dueDate: true } })
  const rev = revenueForecast(deals)
  const coll = collectionForecast(payments)
  const snapshot = await getReportsSnapshot(ws.id, { role: (membership?.role as never) ?? undefined })

  const askResult = q ? await askPipeline(ws.id, q) : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-display font-semibold tracking-tight flex items-center gap-2">
          <Bot className="size-6 text-brand" /> Intelligence
        </h1>
        <p className="text-sm text-muted-foreground">Revenue and collections forecasts, next-best-actions, and a read-only assistant for your pipeline.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2"><TrendingUp className="size-4 text-brand" /> Revenue forecast</CardTitle>
            <CardDescription>Weighted by stage probability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold font-mono tabular-nums">₹{rev.weighted.toLocaleString("en-IN")}</div>
            <div className="text-xs text-muted-foreground font-mono tabular-nums">Pipeline ₹{rev.pipeline.toLocaleString("en-IN")} · {rev.count} deals</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2"><Wallet className="size-4 text-brand" /> Collections</CardTitle>
            <CardDescription>Due in 30d vs overdue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold font-mono tabular-nums text-destructive">₹{coll.overdue.toLocaleString("en-IN")} overdue</div>
            <div className="text-xs text-muted-foreground font-mono tabular-nums">Due 30d ₹{coll.due30.toLocaleString("en-IN")} · next {coll.nextDueDate ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2"><Sparkles className="size-4 text-brand" /> Funnel snapshot</CardTitle>
            <CardDescription>{snapshot.funnel[0]?.count ?? 0} enquiries · {snapshot.inventory.total} units</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex flex-wrap gap-1">
              {snapshot.funnel.slice(0, 4).map((r) => (
                <Badge key={r.stage} variant="secondary" className="font-mono text-xs tabular-nums">{r.stage}: {r.count}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display"><Bot className="size-4 text-brand" /> Ask your pipeline</CardTitle>
          <CardDescription>Try “show funnel”, “overdue payments”, “recent deals”, “recent contacts”, “inventory by status”.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex gap-2">
            <Input name="q" defaultValue={q ?? ""} placeholder="Ask — e.g. overdue payments" className="flex-1 focus-visible:ring-brand" />
            <Button type="submit" className="rounded-lg bg-brand text-brand-foreground hover:bg-brand/90">Ask</Button>
          </form>
          {askResult ? (
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <div className="text-sm font-medium">{askResult.answer}</div>
              {askResult.rows && askResult.rows.length > 0 ? (
                <div className="text-xs font-mono bg-card rounded-lg border p-3 overflow-auto max-h-64">
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
          <div>• <span className="font-medium text-foreground">Follow-up cadence</span> — hot, warm, and cold leads get automatic check-in tasks on your team's timeline.</div>
          <div>• <span className="font-medium text-foreground">Message drafts</span> — ready-to-send WhatsApp and email replies you approve before anything goes out.</div>
          <div>• <span className="font-medium text-foreground">Call analysis</span> — pull budget, unit preference, and intent out of call notes.</div>
        </CardContent>
      </Card>
    </div>
  )
}
