import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Sidebar } from "@/components/shell/sidebar"
import { Topbar } from "@/components/shell/topbar"
import { BottomNav } from "@/components/shell/bottom-nav"
import { ErrorBoundary } from "@/components/ui/error-boundary"

// Auth-walled app routes: never index any /[workspace]/* page.
export const metadata: Metadata = { robots: { index: false, follow: false } }

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-sm focus:bg-background focus:px-4 focus:py-2 focus:shadow-lg focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <Sidebar
        workspace={workspaceLite}
        role={membership.role}
        memberships={memberships.map((m) => ({
          id: m.workspace.id,
          slug: m.workspace.slug,
          name: m.workspace.name,
          role: m.role,
        }))}
      />
      <div className="flex min-w-0 flex-1 flex-col bg-gradient-to-b from-muted/20 via-background to-background">
        <Topbar workspace={workspaceLite} />
        <main id="main-content" className="relative flex-1 overflow-y-auto pb-16 md:pb-0" tabIndex={-1}>
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-0 hidden md:block">
            <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_85%_0%,oklch(0.58_0.16_68/0.05),transparent_60%)]" />
          </div>
          <div className="relative z-10 mx-auto w-full max-w-7xl p-4 md:p-6 space-y-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
        <BottomNav workspaceSlug={workspace.slug} />
      </div>
    </div>
  )
}
