import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getTodayBrief, type TodayAtRiskDeal, type TodayFollowUp, type TodayHotLead, type TodayPaymentDue, type TodayVisit } from "@/lib/today"
import { formatMoney, relativeTime } from "@/lib/format"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowRight, CalendarCheck, CircleAlert, Clock, Flame, Phone, ReceiptText, UserPlus } from "lucide-react"

export const metadata: Metadata = { title: "Today" }

function greeting(firstName: string | null): string {
  const h = new Date().getHours()
  if (h < 5) return "Working late"
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

function TemperatureBadge({ temperature, heatScore }: { temperature: string; heatScore: number }) {
  const cls =
    temperature === "hot"
      ? "bg-red-500/10 text-red-600 dark:text-red-400"
      : temperature === "warm"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : temperature === "nurture"
          ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
          : "bg-muted text-muted-foreground"
  const dot =
    temperature === "hot" ? "🔥" : temperature === "warm" ? "🟠" : temperature === "nurture" ? "🔵" : "⚪"
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", cls)}>
      <span aria-hidden>{dot}</span>
      {temperature === "hot" ? "HOT" : temperature.toUpperCase()} · {heatScore}%
    </span>
  )
}

export default async function TodayPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params
  const session = await auth()
  const user = session?.user

  const workspace = await db.workspace.findUnique({ where: { slug } })
  if (!workspace) notFound()

  const membership = user?.id
    ? await db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      })
    : null
  if (!membership) notFound()

  const brief = await getTodayBrief(workspace.id)
  const firstName = user?.name?.split(/\s+/)[0] ?? null
  const total = brief.progress.total
  const pct = total > 0 ? Math.min(100, Math.round((brief.progress.done / total) * 100)) : 0

  return (
    <div className="space-y-6">
      {/* ——— Hero briefing line ——— */}
      <div className="rounded-[20px] border bg-card p-5 md:p-6 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -right-16 h-48 w-72 rounded-full bg-gradient-to-br from-brand/10 via-amber-500/5 to-transparent blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/25 to-transparent" />
        </div>
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{greeting(firstName)} {firstName ? `, ${firstName}` : ""} 👋</p>
            <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tight sm:text-[28px]">
              {total > 0 ? `You have ${total} ${total === 1 ? "thing" : "things"} worth doing today.` : "You're all caught up."}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hot leads, follow-ups, visits, at-risk deals and payments — surfaced for {workspace.name}.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" className="rounded-full gap-1.5" render={<Link href={`/${slug}/contacts`} />}>
              <UserPlus className="size-3.5" /> Add lead
            </Button>
          </div>
        </div>
        {/* daily progress */}
        <div className="relative mt-4 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <span>
              {brief.progress.done} of {total} important actions done
              {pct >= 100 ? " — cleared today. 🎉" : pct >= 50 ? " — you're on track." : pct > 0 ? " — keep going." : " — start with the priorities below."}
            </span>
            <span className="font-mono tabular-nums">{pct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* ——— Needs attention + Today's schedule ——— */}
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left column: needs attention */}
        <div className="space-y-5">
          <NeedsAttention
            slug={slug}
            hotLeads={brief.hotLeads}
            followUps={brief.followUps}
            atRiskDeals={brief.atRiskDeals}
            paymentsDue={brief.paymentsDue}
          />
        </div>

        {/* Right column: today's schedule */}
        <div>
          <TodaySchedule slug={slug} visits={brief.visits} />
          <QuickActions slug={slug} />
        </div>
      </div>
    </div>
  )
}
type Nullable = string | null | undefined

function formatMoneyDate(d: Date): string {
  const diff = d.getTime() - Date.now()
  const days = Math.round(diff / 86_400_000)
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  return `in ${days}d`
}

function FollowUpCard({ body, contactName, dealTitle, scheduledAt, href }: { body: Nullable; contactName: Nullable; dealTitle: Nullable; scheduledAt: Date; href: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
        <Clock className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{body ?? "Follow up"}</div>
        <div className="truncate text-xs text-muted-foreground">
          {contactName ?? "—"}{dealTitle ? ` · ${dealTitle}` : ""} · due {relativeTime(scheduledAt)}
        </div>
      </div>
      <Button size="sm" variant="ghost" className="h-7 rounded-full text-[12px]" render={<Link href={href} />}>
        Open <ArrowRight className="size-3" />
      </Button>
    </div>
  )
}

function NeedsAttention({
  slug,
  hotLeads,
  followUps,
  atRiskDeals,
  paymentsDue,
}: {
  slug: string
  hotLeads: TodayHotLead[]
  followUps: TodayFollowUp[]
  atRiskDeals: TodayAtRiskDeal[]
  paymentsDue: TodayPaymentDue[]
}) {
  const hasAnything = hotLeads.length + followUps.length + atRiskDeals.length + paymentsDue.length > 0
  if (!hasAnything) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="text-2xl" aria-hidden>🧘</span>
          <p className="text-sm font-medium">Nothing needs attention right now.</p>
          <CardDescription>Hot leads, overdue follow-ups, at-risk deals, and due payments will appear here the moment they happen.</CardDescription>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* 🔥 Hot leads */}
      {hotLeads.length > 0 && (
        <Card className="overflow-hidden">
          <div className="h-1 bg-brand" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Flame className="size-4 text-brand" /> Hot leads — not contacted ({hotLeads.length})
            </CardTitle>
            <CardDescription>High-intent buyers waiting for a touch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {hotLeads.map((l) => (
              <div key={l.contactId} className="rounded-xl border px-3 py-3 transition-colors hover:bg-muted/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{l.name}</span>
                    <TemperatureBadge temperature={l.temperature} heatScore={l.heatScore} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    last activity {l.lastActivityAt ? relativeTime(l.lastActivityAt) : "never"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{l.recommendedAction}</p>
                <div className="mt-2 flex gap-1.5">
                  <Button size="xs" className="h-7 gap-1 rounded-full text-[12px]" render={<Link href={`/${slug}/contacts/${l.contactId}`} />}>
                    <Phone className="size-3" /> {l.ctaLabel}
                  </Button>
                  <Button size="xs" variant="outline" className="h-7 rounded-full text-[12px]" render={<Link href={`/${slug}/contacts/${l.contactId}`} />}>
                    Open lead
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 🟠 Overdue follow-ups */}
      {followUps.length > 0 && (
        <Card className="overflow-hidden">
          <div className="h-1 bg-amber-500" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Clock className="size-4 text-amber-600 dark:text-amber-400" /> Overdue follow-ups ({followUps.length})
            </CardTitle>
            <CardDescription>These were due before today ended. Complete or reschedule.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {followUps.map((t) => (
              <FollowUpCard
                key={t.id}
                body={t.body}
                contactName={t.contactName}
                dealTitle={t.dealTitle}
                scheduledAt={t.scheduledAt}
                href={`/${slug}/tasks`}
              />
            ))}
          </CardContent>
        </Card>
      )}
    {/* ⚠️ At-risk deals */}
      {atRiskDeals.length > 0 && (
        <Card className="overflow-hidden">
          <div className="h-1 bg-red-500" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <CircleAlert className="size-4 text-red-600 dark:text-red-400" /> Deals going cold ({atRiskDeals.length})
            </CardTitle>
            <CardDescription>No activity in a week. One call can save these.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {atRiskDeals.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{d.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {formatMoney(d.value)} · {d.stageName} · silent {d.daysSinceActivity}d
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 rounded-full text-[12px]" render={<Link href={`/${slug}/deals/${d.id}`} />}>
                  Call buyer <ArrowRight className="size-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 💸 Payments due */}
      {paymentsDue.length > 0 && (
        <Card className="overflow-hidden">
          <div className="h-1 bg-sky-500" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <ReceiptText className="size-4 text-sky-600 dark:text-sky-400" /> Payments due ({paymentsDue.length})
            </CardTitle>
            <CardDescription>Demand letters / milestones that need collection follow-up soon.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {paymentsDue.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{formatMoney(p.amount)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.dealTitle}{p.contactName ? ` · ${p.contactName}` : ""} · {p.dueDate ? formatMoneyDate(p.dueDate) : ""}
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 rounded-full text-[12px]" render={<Link href={`/${slug}/bookings`} />}>
                  Follow up <ArrowRight className="size-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  )
}
function TodaySchedule({ slug, visits }: { slug: string; visits: TodayVisit[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-sky-500" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px]">
          <CalendarCheck className="size-4 text-sky-600 dark:text-sky-400" /> Today&apos;s schedule
        </CardTitle>
        <CardDescription>{visits.length === 0 ? "Nothing scheduled today." : "Site visits happening now."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {visits.length === 0 ? (
          <p className="rounded-xl border border-dashed px-3 py-6 text-center text-[13px] text-muted-foreground">
            No site visits today. Use the time on hot leads.
          </p>
        ) : (
          visits.map((v) => (
            <div key={v.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(v.scheduledAt)}
                </span>
                <span className="mt-1 h-full w-px bg-border" />
              </div>
              <div className={cn("min-w-0 flex-1 rounded-xl border px-3 py-2", v.checkedIn ? "bg-emerald-500/5" : "bg-card")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{v.contactName}</span>
                  {v.checkedIn ? (
                    <span className="rounded-full bg-emerald-500/10 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      ✓ Checked in
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {v.unitNo ?? "Unit TBD"}{v.projectName ? ` · ${v.projectName}` : ""}
                </div>
                <Link href={`/${slug}/site-visits`} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline">
                  Open visit <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function QuickActions({ slug }: { slug: string }) {
  return (
    <Card className="mt-5 border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-[14px]">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="rounded-full text-[12px]" render={<Link href={`/${slug}/contacts`} />}>
          Add lead
        </Button>
        <Button size="sm" variant="outline" className="rounded-full text-[12px]" render={<Link href={`/${slug}/deals`} />}>
          Add deal
        </Button>
        <Button size="sm" variant="outline" className="rounded-full text-[12px]" render={<Link href={`/${slug}/site-visits`} />}>
          Schedule visit
        </Button>
        <Button size="sm" variant="outline" className="rounded-full text-[12px]" render={<Link href={`/${slug}/tasks`} />}>
          New follow-up
        </Button>
      </CardContent>
    </Card>
  )
}