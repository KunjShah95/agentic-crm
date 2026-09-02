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
    <div className="space-y-6">
      <div className="rounded-[20px] border bg-card p-5 md:p-6 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 -right-16 h-48 w-64 rounded-full bg-gradient-to-br from-violet-500/10 via-blue-500/10 to-cyan-500/10 blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
        </div>
        <div className="relative">
          <h1 className="text-[22px] font-semibold tracking-tight">My Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">{open.length} open · {completed.length} completed · Activities with assigneeId = you</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500" />
          <CardHeader className="flex-row items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><Circle className="size-4" /></span>
            <div>
              <CardTitle className="text-base">Open <span className="ml-1 rounded-full bg-violet-500 px-1.5 py-0.5 font-mono text-[11px] text-white">{open.length}</span></CardTitle>
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
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          <CardHeader className="flex-row items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="size-4" /></span>
            <div>
              <CardTitle className="text-base">Completed <span className="ml-1 rounded-full bg-emerald-500 px-1.5 py-0.5 font-mono text-[11px] text-white">{completed.length}</span></CardTitle>
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
