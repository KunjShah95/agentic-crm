import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CheckCircle2, Circle } from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { TaskList } from "@/components/activities/task-list"
import { NewTaskDialog } from "@/components/activities/new-task-dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = { title: "My Tasks" }

export default async function TasksPage({
  params,
}: {
  params: Promise<{ workspace: string }>
}) {
  const { workspace: slug } = await params
  const session = await auth()

  const workspace = await db.workspace.findUnique({ where: { slug } })
  if (!workspace) notFound()

  const membership = session?.user?.id
    ? await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: session.user.id,
          },
        },
      })
    : null
  if (!membership) notFound()

  const tasks = await db.activity.findMany({
    where: {
      workspaceId: workspace.id,
      type: "TASK",
      assigneeId: session!.user!.id,
    },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      deal: { select: { id: true, title: true } },
    },
    orderBy: [{ completedAt: "asc" }, { scheduledAt: "asc" }],
  })

  const open = tasks.filter((t) => !t.completedAt)
  const completed = tasks.filter((t) => t.completedAt)

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-card p-5 md:p-6">
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">My Tasks</h1>
            <p className="mt-1 text-sm text-muted-foreground">{open.length} open · {completed.length} completed · assigned to you</p>
          </div>
          <NewTaskDialog workspaceId={workspace.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="h-1 bg-brand" />
          <CardHeader className="flex-row items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-sm bg-brand/10 text-brand"><Circle className="size-4" /></span>
            <div>
              <CardTitle className="text-base">Open <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-[11px] text-white">{open.length}</span></CardTitle>
              <CardDescription>To-dos assigned to you</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TaskList
              workspaceId={workspace.id}
              workspaceSlug={slug}
              tasks={open}
              emptyMessage="No open tasks — you're all caught up ✨"
            />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="h-1 bg-status-positive-fg" />
          <CardHeader className="flex-row items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-sm bg-status-positive-bg text-status-positive-fg"><CheckCircle2 className="size-4" /></span>
            <div>
              <CardTitle className="text-base">Completed <span className="ml-1 rounded-full bg-status-positive-bg px-1.5 py-0.5 text-[11px] text-status-positive-fg">{completed.length}</span></CardTitle>
              <CardDescription>Recently finished tasks</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TaskList
              workspaceId={workspace.id}
              workspaceSlug={slug}
              tasks={completed}
              emptyMessage="Nothing completed yet."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
