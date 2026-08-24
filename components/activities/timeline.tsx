"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Mail,
  Phone,
  StickyNote,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { completeTaskAction } from "@/lib/actions/activities"
import { relativeTime, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"

type TimelineActivity = {
  id: string
  type: "NOTE" | "EMAIL" | "CALL" | "MEETING" | "TASK"
  body: string | null
  scheduledAt: Date | null
  completedAt: Date | null
  createdAt: Date
  contactId: string | null
  dealId: string | null
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

  return (
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
  )
}
