"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, Circle, ListTodo } from "lucide-react"

import { completeTaskAction } from "@/lib/actions/activities"
import { formatDate, relativeTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

type Task = {
  id: string
  body: string | null
  scheduledAt: Date | null
  completedAt: Date | null
  createdAt: Date
  contact: { id: string; firstName: string; lastName: string } | null
  deal: { id: string; title: string } | null
}

export function TaskList({
  workspaceId,
  workspaceSlug,
  tasks,
  emptyMessage,
}: {
  workspaceId: string
  workspaceSlug: string
  tasks: Task[]
  emptyMessage: string
}) {
  const router = useRouter()

  async function toggle(taskId: string, completed: boolean) {
    const result = await completeTaskAction(workspaceId, taskId, completed)
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success(completed ? "Task completed 🎉" : "Task reopened")
    router.refresh()
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
        <ListTodo className="size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => {
        const done = !!task.completedAt
        return (
          <div
            key={task.id}
            className="flex items-start gap-3 rounded-lg border bg-card px-3.5 py-3"
          >
            <Checkbox
              checked={done}
              onCheckedChange={(checked) => toggle(task.id, !!checked)}
              className="mt-0.5"
              aria-label={done ? "Reopen task" : "Complete task"}
            />
            <div className="min-w-0 flex-1">
              <p
                className={
                  done
                    ? "text-sm text-muted-foreground line-through"
                    : "text-sm font-medium"
                }
              >
                {task.body ?? "Untitled task"}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {task.scheduledAt && (
                  <span className="inline-flex items-center gap-1">
                    {done ? (
                      <CheckCircle2 className="size-3.5 text-primary" />
                    ) : (
                      <Circle className="size-3.5" />
                    )}
                    {formatDate(task.scheduledAt)}
                  </span>
                )}
                <span>created {relativeTime(task.createdAt)}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              {task.deal && (
                <Link href={`/${workspaceSlug}/deals/${task.deal.id}`}>
                  <Badge variant="secondary" className="text-[11px]">
                    {task.deal.title}
                  </Badge>
                </Link>
              )}
              {task.contact && (
                <Link href={`/${workspaceSlug}/contacts/${task.contact.id}`}>
                  <Badge variant="outline" className="text-[11px]">
                    {task.contact.firstName} {task.contact.lastName}
                  </Badge>
                </Link>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
