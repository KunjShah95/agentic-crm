"use client"

import { useSession } from "next-auth/react"

import { CommandMenu } from "@/components/shell/command-menu"
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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
          {workspace.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="truncate text-sm font-medium">{workspace.name}</span>
      </div>

      <CommandMenu workspaceSlug={workspace.slug} workspaces={workspaces} />

      <div className="ml-auto flex items-center gap-1">
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
