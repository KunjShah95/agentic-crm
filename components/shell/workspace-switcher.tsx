"use client"

import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type LiteWorkspace = {
  id: string
  slug: string
  name: string
  role: string
}

export function WorkspaceSwitcher({
  active,
  workspaces,
}: {
  active: LiteWorkspace
  workspaces: LiteWorkspace[]
}) {
  const router = useRouter()
  const { update } = useSession()

  function switchTo(ws: LiteWorkspace) {
    if (ws.id === active.id) return
    // Persist the new active workspace in the JWT via session update
    void update({ activeWorkspaceId: ws.id })
    router.push(`/${ws.slug}/contacts`)
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-9 w-full justify-start gap-2 px-2 text-left font-medium hover:bg-accent"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
              {active.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate">{active.name}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" side="right" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuGroup>
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onSelect={() => switchTo(ws)}
              className="gap-2"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold">
                {ws.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">{ws.name}</span>
              {ws.id === active.id && (
                <Check className="size-4 text-primary" />
              )}
              <DropdownMenuShortcut className="uppercase text-[10px]">
                {ws.role}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => router.push("/signup")}
          className="gap-2"
        >
          <Plus className="size-4" />
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
