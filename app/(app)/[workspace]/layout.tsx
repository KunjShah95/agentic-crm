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
    <div className="app-scope flex h-dvh overflow-hidden bg-surface-canvas">
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
      {/*
        The column is a fixed-height flex stack, not a page: the sidebar and
        topbar stay put while `main` scrolls underneath. Painting the canvas on
        this wrapper (rather than letting each page own its background) means
        overscroll shows app chrome, not white.
      */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar workspace={workspaceLite} />
        <main
          id="main-content"
          tabIndex={-1}
          className="relative min-h-0 flex-1 overflow-y-auto pb-16 outline-none md:pb-0"
          style={{ scrollbarGutter: "stable" }}
        >
          {/*
            Staggered entrance, capped at ~5 chunks. Each direct child of a page
            root fades up ~6px in sequence so the page assembles in reading
            order instead of appearing as one slab. `animation-fill-mode:
            backwards` is what hides the pre-delay state — without it the first
            frame paints the element at full opacity and the animation is a
            no-op. The animation is one-shot, so it does not replay on the
            back/forward cache and is not interruptible, which is why it is a
            keyframe rather than a transition.
          */}
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
            <div className="space-y-6 [&>*]:animate-rise-in motion-reduce:[&>*]:animate-none">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </div>
        </main>
        <BottomNav workspaceSlug={workspace.slug} />
      </div>
    </div>
  )
}
