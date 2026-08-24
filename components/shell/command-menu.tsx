"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import {
  Building2,
  CheckSquare,
  Command,
  KanbanSquare,
  Laptop,
  Moon,
  Search,
  Sun,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Command as CommandPrimitive,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

const NAV = [
  { slug: "contacts", label: "Contacts", icon: Users },
  { slug: "deals", label: "Deals", icon: KanbanSquare },
  { slug: "organizations", label: "Organizations", icon: Building2 },
  { slug: "tasks", label: "Tasks", icon: CheckSquare },
  { slug: "search", label: "Global search", icon: Search },
]

export function CommandMenu({
  workspaceSlug,
  workspaces,
}: {
  workspaceSlug: string
  workspaces: { id: string; slug: string; name: string }[]
}) {
  const router = useRouter()
  const { update } = useSession()
  const { setTheme } = useTheme()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  function run(fn: () => void) {
    setOpen(false)
    fn()
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandPrimitive>
          <CommandInput placeholder="Jump to a page, workspace, or action…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {NAV.map((item) => (
                <CommandItem
                  key={item.slug}
                  value={`nav-${item.slug}`}
                  onSelect={() => run(() => router.push(`/${workspaceSlug}/${item.slug}`))}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Workspaces">
              {workspaces.map((ws) => (
                <CommandItem
                  key={ws.id}
                  value={`ws-${ws.name}`}
                  onSelect={() =>
                    run(() => {
                      void update({ activeWorkspaceId: ws.id })
                      router.push(`/${ws.slug}/contacts`)
                    })
                  }
                >
                  <span className="flex size-4 items-center justify-center rounded bg-muted text-[9px] font-bold">
                    {ws.name.slice(0, 2).toUpperCase()}
                  </span>
                  {ws.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Appearance">
              <CommandItem value="theme-light" onSelect={() => run(() => setTheme("light"))}>
                <Sun className="size-4" />
                Light mode
              </CommandItem>
              <CommandItem value="theme-dark" onSelect={() => run(() => setTheme("dark"))}>
                <Moon className="size-4" />
                Dark mode
              </CommandItem>
              <CommandItem value="theme-system" onSelect={() => run(() => setTheme("system"))}>
                <Laptop className="size-4" />
                System theme
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandPrimitive>
      </CommandDialog>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-8 w-full max-w-56 items-center gap-2 rounded-md border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search or jump…</span>
        <kbd className="pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <Command className="size-3" />
          K
        </kbd>
      </button>
    </>
  )
}
