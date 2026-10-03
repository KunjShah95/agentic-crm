"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, Circle, ListTodo, Trash2 } from "lucide-react"

import { completeTaskAction, deleteTaskAction } from "@/lib/actions/activities"
import { formatDate, relativeTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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

  async function remove(taskId: string) {
    const result = await deleteTaskAction(workspaceId, taskId)
    if (result.error) {
      toast.error(result.error.message)
      return
    }
    toast.success("Task deleted")
    router.refresh()
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-10 text-center">
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
          /* `flex-wrap` + the badge column going full-width below `sm`. The row is
             three things in a line — checkbox, task text, badges — and on a 390px
             card that is not enough width for all three. Forcing the badges to
             keep their place beside the text either clipped them off the card
             (`shrink-0`, with the Card's `overflow-hidden` eating them) or, once
             they were allowed to shrink, squeezed the task text to one word per
             line. Both were measured.

             Letting the badge column take its own line on a phone is the honest
             answer: the task text is the content, the badges are context about
             the content, and context does not outrank content for width. From
             `sm` up there is room and they sit inline again. */
          <div
            key={task.id}
            className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md border bg-card px-3.5 py-3"
          >
            <Checkbox
              checked={done}
              onCheckedChange={(checked) => toggle(task.id, !!checked)}
              className="mt-0.5"
              aria-label={done ? "Reopen task" : "Complete task"}
            />
            <div className="min-w-0 flex-1 basis-40">
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
            {/* `min-w-0` on this column, and `max-w-full` + `truncate` on the deal
                badge. `shrink-0` here was the bug: it told the badge column never
                to yield width, so on a 390px card the deal and contact badges
                were pushed past the card's right edge and then silently clipped
                away by the Card's `overflow-hidden`. A task's linked deal — the
                context that makes the task mean anything — simply disappeared.

                `flex-wrap` alone was not enough, because a flex child defaults to
                `min-width: auto` and refuses to shrink below its content. The
                column now yields, the badge truncates inside it, and the delete
                button stays pinned because it is genuinely `shrink-0`. */}
            <div className="flex min-w-0 basis-full flex-wrap items-start gap-1 sm:basis-auto sm:justify-end">
              {task.deal && (
                <Link
                  href={`/${workspaceSlug}/deals/${task.deal.id}`}
                  className="min-w-0 max-w-full"
                >
                  <Badge variant="secondary" className="block max-w-full truncate text-[11px]">
                    {task.deal.title}
                  </Badge>
                </Link>
              )}
              {task.contact && (
                <Link
                  href={`/${workspaceSlug}/contacts/${task.contact.id}`}
                  className="min-w-0 max-w-full"
                >
                  <Badge variant="outline" className="block max-w-full truncate text-[11px]">
                    {task.contact.firstName} {task.contact.lastName}
                  </Badge>
                </Link>
              )}
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Delete task"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {task.body ?? "Untitled task"} — this can&apos;t be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => remove(task.id)}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )
      })}
    </div>
  )
}
