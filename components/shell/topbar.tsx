"use client"

import { useSession } from "next-auth/react"

import { CommandMenu } from "@/components/shell/command-menu"
import { MobileNav } from "@/components/shell/mobile-nav"
import { ModeToggle } from "@/components/shell/mode-toggle"
import { UserMenu } from "@/components/shell/user-menu"

export function Topbar({
  workspace,
}: {
  workspace: { id: string; slug: string; name: string }
}) {
  const { data: session } = useSession()
  const workspaces =
    session?.workspaces.map((ws) => ({
      id: ws.id,
      slug: ws.slug,
      name: ws.name,
    })) ?? []

  return (
    <header
      className={[
        // The bar is sticky within a non-scrolling column, so it never needs to
        // blur its own content — but the app canvas scrolls *under* it, so a
        // translucent bar with a backdrop is what keeps rows from smearing
        // through on fast scroll.
        "flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur-xl",
        "supports-[backdrop-filter]:bg-background/60",
        "md:px-6",
      ].join(" ")}
    >
      <MobileNav workspaceSlug={workspace.slug} workspaceName={workspace.name} />

      {/*
        On mobile the sidebar is a drawer, so the workspace needs an anchor in
        the bar. From `md` up the sidebar is always visible and already names the
        workspace — repeating it here is noise, so the block retires.
      */}
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-xs bg-foreground text-[10px] font-bold text-background">
          {workspace.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="truncate text-sm font-medium">{workspace.name}</span>
      </div>

      <div className="flex min-w-0 flex-1">
        <CommandMenu workspaceSlug={workspace.slug} workspaces={workspaces} />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ModeToggle />
        <UserMenu
          user={{
            id: session?.user.id ?? "",
            name: session?.user.name ?? "User",
            email: session?.user.email ?? "",
            image: session?.user.image ?? null,
          }}
          workspaceSlug={workspace.slug}
        />
      </div>
    </header>
  )
}
