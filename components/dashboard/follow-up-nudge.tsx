import Link from "next/link"
import { AlertTriangle, Clock, CircleDashed } from "lucide-react"
import { cn } from "@/lib/utils"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"

export async function FollowUpNudge({ workspaceId, workspaceSlug }: { workspaceId: string; workspaceSlug: string }) {
  const now = new Date()
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const [overdueActivities, upcomingActivities, staleDeals] = await Promise.all([
    db.activity.findMany({
      where: {
        workspaceId,
        scheduledAt: { lt: now },
        completedAt: null,
      },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, title: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    db.activity.findMany({
      where: {
        workspaceId,
        scheduledAt: { gte: now, lte: next24h },
        completedAt: null,
      },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, title: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    db.deal.findMany({
      where: {
        workspaceId,
        activities: {
          none: {
            createdAt: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
          },
        },
      },
      include: {
        stage: { select: { name: true, color: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 5,
    }),
  ])

  if (overdueActivities.length === 0 && upcomingActivities.length === 0 && staleDeals.length === 0) {
    return null
  }

  function timeAgo(date: Date) {
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days > 0) return `${days}d ago`
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours > 0) return `${hours}h ago`
    return "just now"
  }

  function timeUntil(date: Date) {
    const diff = date.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours > 24) return `in ${Math.floor(hours / 24)}d`
    if (hours > 0) return `in ${hours}h`
    return "soon"
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/*
        Each column is one severity of "you are falling behind", so they share
        one component and differ only by the status token they pass in. The
        panel colour, the heading, the count badge and the row tint all derive
        from that single choice — which is what stops the four palettes of raw
        red/amber/orange this file used to carry (and the light/dark pairs for
        each) from drifting apart. Adding a fourth severity is now one line.
      */}
      {overdueActivities.length > 0 && (
        <NudgePanel
          tone="critical"
          icon={AlertTriangle}
          title="Overdue"
          count={overdueActivities.length}
          emptyHint="Nothing overdue. Keep it that way."
        >
          {overdueActivities.map((a) => (
            <NudgeRow
              key={a.id}
              href={`/${workspaceSlug}/contacts/${a.contactId ?? ""}`}
              meta={a.type}
              when={timeAgo(a.scheduledAt!)}
            >
              {a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : a.deal?.title}
            </NudgeRow>
          ))}
        </NudgePanel>
      )}

      {upcomingActivities.length > 0 && (
        <NudgePanel
          tone="caution"
          icon={Clock}
          title="Upcoming"
          count={upcomingActivities.length}
          emptyHint="Nothing scheduled in the next 24 hours."
        >
          {upcomingActivities.map((a) => (
            <NudgeRow
              key={a.id}
              href={`/${workspaceSlug}/contacts/${a.contactId ?? ""}`}
              meta={a.type}
              when={timeUntil(a.scheduledAt!)}
            >
              {a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : a.deal?.title}
            </NudgeRow>
          ))}
        </NudgePanel>
      )}

      {staleDeals.length > 0 && (
        <NudgePanel
          tone="caution"
          icon={CircleDashed}
          title="Stale deals"
          count={staleDeals.length}
          emptyHint="Every deal has recent activity."
        >
          {staleDeals.map((d) => (
            <NudgeRow
              key={d.id}
              href={`/${workspaceSlug}/deals/${d.id}`}
              meta={d.stage.name}
              when="3d+ quiet"
              leadingDot={d.stage.color}
            >
              {d.title}
            </NudgeRow>
          ))}
        </NudgePanel>
      )}
    </div>
  )
}

type Tone = "critical" | "caution" | "positive" | "info"

/**
 * Status tone → the token pair that paints it.
 *
 * The `*-bg` values are warm-neutral tints rather than saturated washes, which
 * is what keeps these panels quiet against the canvas instead of shouting. In
 * dark mode the same tokens are already re-tinted, so a panel is correct in
 * both themes with no second palette to maintain.
 */
const TONE = {
  critical: "border-hairline bg-status-critical-bg/45 text-status-critical-fg",
  caution: "border-hairline bg-status-caution-bg/45 text-status-caution-fg",
  positive: "border-hairline bg-status-positive-bg/45 text-status-positive-fg",
  info: "border-hairline bg-status-info-bg/45 text-status-info-fg",
} as const satisfies Record<Tone, string>

function NudgePanel({
  tone,
  icon: Icon,
  title,
  count,
  emptyHint,
  children,
}: {
  tone: Tone
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  count: number
  emptyHint: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("rounded-md border p-4", TONE[tone])}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 shrink-0" strokeWidth={1.75} />
        {/* Section title: 13px/600 sans. Fraunces belongs to the page h1 and
            stat numerals only — a serif at this size reads as a mistake. */}
        <h3 className="text-[13px] font-semibold leading-5">{title}</h3>
        <Badge
          variant="outline"
          className="ml-auto h-5 rounded-full border-current/25 bg-background/60 px-1.5 text-[10px] tabular-nums text-current"
        >
          {count}
        </Badge>
      </div>
      <div className="space-y-1.5">{children}</div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{emptyHint}</p>
    </section>
  )
}

function NudgeRow({
  href,
  meta,
  when,
  leadingDot,
  children,
}: {
  href: string
  meta: string
  when: string
  leadingDot?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-sm bg-background/70 p-2 text-xs",
        "transition-colors duration-150 hover:bg-background"
      )}
    >
      <div className="flex items-center gap-1.5">
        {leadingDot ? (
          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: leadingDot }} />
        ) : null}
        {/* Activity type is chrome, not data — sans, not the mono the token
            policy reserves for money and identifiers. */}
        <span className="truncate font-medium text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
          {meta}
        </span>
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">{when}</span>
      </div>
      <p className="mt-1 truncate text-[13px] font-medium text-foreground">{children}</p>
    </Link>
  )
}
