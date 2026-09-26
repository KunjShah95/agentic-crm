import Link from "next/link"
import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { db } from "@/lib/db"
import { Badge } from "@/components/ui/badge"

export async function FollowUpNudge({ workspaceId, workspaceSlug }: { workspaceId: string; workspaceSlug: string }) {
  const now = new Date()
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const next7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

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
      {/* Overdue */}
      {overdueActivities.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">Overdue</h3>
            <Badge variant="outline" className="ml-auto rounded-full border-red-200 text-red-600 text-[10px] dark:border-red-800 dark:text-red-400">
              {overdueActivities.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {overdueActivities.map((a) => (
              <Link
                key={a.id}
                href={`/${workspaceSlug}/contacts/${a.contactId ?? ""}`}
                className="block rounded-lg bg-white/60 p-2 text-xs hover:bg-white dark:bg-red-900/30 dark:hover:bg-red-900/50"
              >
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="rounded-full text-[9px]">{a.type}</Badge>
                  <span className="text-muted-foreground">{timeAgo(a.scheduledAt!)}</span>
                </div>
                <p className="mt-1 truncate text-red-800 dark:text-red-200">
                  {a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : a.deal?.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcomingActivities.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Upcoming</h3>
            <Badge variant="outline" className="ml-auto rounded-full border-amber-200 text-amber-600 text-[10px] dark:border-amber-800 dark:text-amber-400">
              {upcomingActivities.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {upcomingActivities.map((a) => (
              <Link
                key={a.id}
                href={`/${workspaceSlug}/contacts/${a.contactId ?? ""}`}
                className="block rounded-lg bg-white/60 p-2 text-xs hover:bg-white dark:bg-amber-900/30 dark:hover:bg-amber-900/50"
              >
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="rounded-full text-[9px]">{a.type}</Badge>
                  <span className="text-muted-foreground">{timeUntil(a.scheduledAt!)}</span>
                </div>
                <p className="mt-1 truncate text-amber-800 dark:text-amber-200">
                  {a.contact ? `${a.contact.firstName} ${a.contact.lastName}` : a.deal?.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stale deals */}
      {staleDeals.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="size-4 text-orange-600 dark:text-orange-400" />
            <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-200">Stale deals</h3>
            <Badge variant="outline" className="ml-auto rounded-full border-orange-200 text-orange-600 text-[10px] dark:border-orange-800 dark:text-orange-400">
              {staleDeals.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {staleDeals.map((d) => (
              <Link
                key={d.id}
                href={`/${workspaceSlug}/deals/${d.id}`}
                className="block rounded-lg bg-white/60 p-2 text-xs hover:bg-white dark:bg-orange-900/30 dark:hover:bg-orange-900/50"
              >
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: d.stage.color }} />
                  <span className="truncate font-medium text-orange-800 dark:text-orange-200">{d.title}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : "No contact"} · {d.stage.name}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
