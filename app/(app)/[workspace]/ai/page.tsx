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
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Bot className="size-6 text-violet-600" /> Intelligence <Badge variant="secondary" className="rounded-full">P0 · Agentic AI</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">Next-best-action, follow-up cadence, drafting, call analysis, Ask pipeline, forecast — Jarvis parity, workspace-scoped.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="size-4" /> Revenue forecast</CardTitle>
            <CardDescription>Weighted by stage probability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">₹{rev.weighted.toLocaleString("en-IN")}</div>
            <div className="text-xs text-muted-foreground">Pipeline ₹{rev.pipeline.toLocaleString("en-IN")} · {rev.count} deals</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Wallet className="size-4" /> Collections</CardTitle>
            <CardDescription>Due in 30d vs overdue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">₹{coll.overdue.toLocaleString("en-IN")} overdue</div>
            <div className="text-xs text-muted-foreground">Due 30d ₹{coll.due30.toLocaleString("en-IN")} · next {coll.nextDueDate ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4" /> Funnel snapshot</CardTitle>
            <CardDescription>{snapshot.funnel[0]?.count ?? 0} INQUIRY · {snapshot.inventory.total} units</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex flex-wrap gap-1">
              {snapshot.funnel.slice(0, 4).map((r) => (
                <Badge key={r.stage} variant="secondary" className="font-mono text-xs">{r.stage}: {r.count}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bot className="size-4" /> Ask your pipeline</CardTitle>
          <CardDescription>Try “show funnel”, “overdue payments”, “recent deals”, “recent contacts”, “inventory by status”.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={`/ai`} className="flex gap-2">
            {/* client will use searchParams */}
          </form>
          <form className="flex gap-2">
            <Input name="q" defaultValue={q ?? ""} placeholder="Ask — e.g. overdue payments" className="flex-1" />
            <Button type="submit" className="rounded-full">Ask</Button>
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
            <p className="text-xs text-muted-foreground">Workspace-scoped, read-only. No data leaves the workspace.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to use</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <div>• <span className="font-medium text-foreground">suggestActions</span> — ranked CALL/WHATSAPP/SITE_VISIT per score + idle + stage (pure, tested).</div>
          <div>• <span className="font-medium text-foreground">scheduleFollowUps</span> — cadence hot/warm/cold → 3 Activity rows; call <span className="font-mono">modules/ai/actions.createFollowUps</span>.</div>
          <div>• <span className="font-medium text-foreground">draftMessage</span> — intent → WhatsApp/email stub (LLM-swappable).</div>
          <div>• <span className="font-medium text-foreground">analyzeCall</span> — transcript → budget/config/sentiment (regex, LLM-ready).</div>
        </CardContent>
      </Card>
    </div>
  )
}
