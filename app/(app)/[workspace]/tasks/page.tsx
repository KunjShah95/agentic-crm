import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CheckCircle2, Circle } from "lucide-react"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { TaskList } from "@/components/activities/task-list"
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
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1>
        <p className="text-sm text-muted-foreground">
          {open.length} open · {completed.length} completed
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Circle className="size-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Open</CardTitle>
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

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <CheckCircle2 className="size-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Completed</CardTitle>
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
