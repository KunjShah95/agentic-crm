import { notFound, redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Sidebar } from "@/components/shell/sidebar"
import { Topbar } from "@/components/shell/topbar"

export default async function WorkspaceLayout({
  params,
  children,
}: {
  params: Promise<{ workspace: string }>
  children: React.ReactNode
}) {
  const { workspace: slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const workspace = await db.workspace.findUnique({
    where: { slug },
    include: {
      stages: { orderBy: { order: "asc" } },
    },
  })
  if (!workspace) notFound()

  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: session.user.id },
    },
  })
  if (!membership) notFound()

  const memberships = await db.workspaceMember.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      workspace: { select: { id: true, slug: true, name: true } },
    },
  })

  const workspaceLite = {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    plan: workspace.plan,
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        workspace={workspaceLite}
        role={membership.role}
        memberships={memberships.map((m) => ({
          id: m.workspace.id,
          slug: m.workspace.slug,
          name: m.workspace.name,
          role: m.role,
        }))}
        user={{
          id: session.user.id,
          name: session.user.name ?? "",
          email: session.user.email ?? "",
          image: session.user.image ?? null,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col bg-gradient-to-b from-muted/20 via-background to-background">
        <Topbar workspace={workspaceLite} />
        <main className="flex-1 overflow-y-auto">
          <div className="pointer-events-none fixed inset-y-0 left-[240px] right-0 -z-10 hidden md:block">
            <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_85%_0%,rgba(139,92,246,0.06),transparent_60%)]" />
          </div>
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6 space-y-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
