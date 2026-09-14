"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Link as LinkIcon,
  Mail,
  MessageSquare,
  Phone,
  StickyNote,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { completeTaskAction } from "@/lib/actions/activities"
import { relativeTime, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"

export type TimelineActivity = {
  id: string
  type: "NOTE" | "EMAIL" | "CALL" | "MEETING" | "TASK"
  body: string | null
  scheduledAt: Date | null
  completedAt: Date | null
  createdAt: Date
  contactId: string | null
  dealId: string | null
  source?: string | null
  channel?: string | null
  socialEvent?: { provider: string; type: string } | null
  deal?: { id: string; title: string } | null
  contact?: { id: string; firstName: string; lastName: string } | null
  createdBy: string
}

const ICONS = {
  NOTE: StickyNote,
  EMAIL: Mail,
  CALL: Phone,
  MEETING: CalendarDays,
  TASK: CheckCircle2,
}

const TYPE_LABELS: Record<string, string> = {
  NOTE: "Note",
  EMAIL: "Email",
  CALL: "Call",
  MEETING: "Meeting",
  TASK: "Task",
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  social: "Social",
  agent: "AI",
  system: "System",
  WEBSITE_CONTACT_FORM: "Web",
}

const SOURCE_ICONS: Record<string, React.ElementType> = {
  manual: StickyNote,
  social: MessageSquare,
  agent: LinkIcon,
  system: CheckCircle2,
  WEBSITE_CONTACT_FORM: Mail,
}

function SourceFilterBar({
  sources,
  onFilter,
}: {
  sources: Array<{ id: string; label: string; icon: React.ElementType; count: number; enabled: boolean }>
  onFilter: (sources: string[]) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {sources.map((s) => (
        <button
          key={s.id}
          onClick={() => {
            const next = sources
              .map((x) => ({ ...x, enabled: x.id === s.id ? !x.enabled : x.enabled }))
              .map((x) => (x.enabled ? x.id : null))
              .filter(Boolean)
            if (next.length === 0) {
              onFilter(sources.map((x) => x.id))
            } else {
              onFilter(next as string[])
            }
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            s.enabled
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          <s.icon className="size-3" />
          {s.label}
          <span className={cn("rounded-full bg-current/20 px-1.5 text-[10px]", s.enabled && "bg-current/30")}>
            {s.count}
          </span>
        </button>
      ))}
    </div>
  )
}

export function Timeline({
  activities,
  users,
  workspaceId,
  workspaceSlug,
}: {
  activities: TimelineActivity[]
  users: Map<string, { name: string }>
  workspaceId: string
  workspaceSlug: string
}) {
  const router = useRouter()

  // Derive source from activity — prefer explicit source, fall back to channel-based inference
  function activitySource(a: TimelineActivity): string {
    if (a.source) return a.source
    if (a.channel) {
      const map: Record<string, string> = {
        WHATSAPP: "social",
        SMS: "social",
        EMAIL: "manual",
        CALL: "manual",
        WEB: "manual",
        LEAD: "manual",
        SITE_VISIT: "system",
      }
      return map[a.channel] ?? "manual"
    }
    return "manual"
  }

  // Count activities per source
  const sourceCounts: Record<string, number> = {}
  const allSources = new Set<string>()
  for (const a of activities) {
    const src = activitySource(a)
    allSources.add(src)
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
  }

  // Build filter bar entries — show only sources that have data
  const sourceEntries = [
    { id: "manual", label: "Manual", icon: StickyNote },
    { id: "social", label: "Social", icon: MessageSquare },
    { id: "agent", label: "AI", icon: LinkIcon },
    { id: "system", label: "System", icon: CheckCircle2 },
  ].filter((e) => allSources.has(e.id)).map((e) => ({
    id: e.id,
    label: SOURCE_LABELS[e.id] ?? e.id,
    icon: e.icon,
    count: sourceCounts[e.id] ?? 0,
    enabled: true,
  }))

  // If all entries would be shown and there are 4, default social+agent off if they have 0
  const defaultOff = sourceEntries.filter((e) => e.count === 0 && e.id !== "manual")
  const initialEnabled = sourceEntries
    .filter((e) => !defaultOff.some((d) => d.id === e.id))
    .map((e) => e.id)

  const [enabledSources, setEnabledSources] = useState<string[]>(initialEnabled)
  const filteredActivities = enabledSources.length === sourceEntries.length
    ? activities
    : activities.filter((a) => enabledSources.includes(activitySource(a)))

  function handleSourceToggle(sources: string[]) {
    setEnabledSources(sources)
  }

  async function toggleTask(activityId: string, completed: boolean) {
    const result = await completeTaskAction(workspaceId, activityId, completed)
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success(completed ? "Task completed 🎉" : "Task reopened")
    router.refresh()
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
        <Users className="size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">No activity yet</p>
        <p className="text-sm text-muted-foreground">
          Log notes, emails, calls, meetings, and tasks here.
        </p>
      </div>
    )
  }

  const hasFilters = enabledSources.length < sourceEntries.length

  return (
    <div>
      {sourceEntries.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Show:</span>
          <SourceFilterBar
            sources={sourceEntries.map((s) => ({
              id: s.id,
              label: s.label,
              icon: s.icon,
              count: s.count,
              enabled: enabledSources.includes(s.id),
            }))}
            onFilter={handleSourceToggle}
          />
          {hasFilters && (
            <button
              onClick={() => setEnabledSources(sourceEntries.map((s) => s.id))}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-border">
      {activities.map((activity) => {
        const Icon = ICONS[activity.type]
        const author = users.get(activity.createdBy)
        const isTask = activity.type === "TASK"
        const done = !!activity.completedAt

        return (
          <li key={activity.id} className="relative flex gap-3 pl-1">
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background",
                done && "border-primary/30 bg-primary/5"
              )}
            >
              <Icon
                className={cn(
                  "size-3.5 text-muted-foreground",
                  done && "text-primary"
                )}
              />
            </span>

            <div className="min-w-0 flex-1 rounded-lg border bg-card px-3.5 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {author?.name ?? "Unknown"}
                </span>
                <span>
                  logged a {TYPE_LABELS[activity.type].toLowerCase()}
                </span>
                <span>· {relativeTime(activity.createdAt)}</span>
                {isTask && activity.scheduledAt && (
                  <span>· due {formatDate(activity.scheduledAt)}</span>
                )}
                <span className="ml-auto">
                  {activity.socialEvent ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize"
                      style={{ borderColor: activity.source === "social" ? "#22c55e" : "inherit", color: activity.source === "social" ? "#22c55e" : "inherit" }}
                    >
                      <MessageSquare className="size-3 mr-0.5" />
                      {activity.socialEvent.provider}
                    </Badge>
                  ) : activity.channel ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {activity.channel}
                    </Badge>
                  ) : null}
                </span>
              </div>

              {activity.body && (
                <p
                  className={cn(
                    "mt-1.5 text-sm whitespace-pre-wrap text-foreground/90",
                    done && "text-muted-foreground line-through"
                  )}
                >
                  {activity.body}
                </p>
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {isTask && (
                  <button
                    type="button"
                    onClick={() => toggleTask(activity.id, !done)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {done ? (
                      <Circle className="size-3.5" />
                    ) : (
                      <CheckCircle2 className="size-3.5 text-primary" />
                    )}
                    {done ? "Mark incomplete" : "Mark complete"}
                  </button>
                )}
                {activity.deal && (
                  <Link href={`/${workspaceSlug}/deals/${activity.deal.id}`}>
                    <Badge variant="secondary" className="text-[11px]">
                      {activity.deal.title}
                    </Badge>
                  </Link>
                )}
                {activity.contact && (
                  <Link
                    href={`/${workspaceSlug}/contacts/${activity.contact.id}`}
                  >
                    <Badge variant="outline" className="text-[11px]">
                      {activity.contact.firstName} {activity.contact.lastName}
                    </Badge>
                  </Link>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
    </div>
  )
}
