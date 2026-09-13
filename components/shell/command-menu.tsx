"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import {
  Building2,
  CheckSquare,
  Command,
  CornerDownLeft,
  KanbanSquare,
  Laptop,
  Loader2,
  Moon,
  Search,
  Sun,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { globalSearchAction, type GlobalSearchResult } from "@/lib/actions/search"
import {
  Command as CommandPrimitive,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

const NAV = [
  { slug: "contacts", label: "Contacts", icon: Users },
  { slug: "deals", label: "Deals", icon: KanbanSquare },
  { slug: "organizations", label: "Organizations", icon: Building2 },
  { slug: "tasks", label: "Tasks", icon: CheckSquare },
]

const EMPTY: GlobalSearchResult = { contacts: [], organizations: [], deals: [], total: 0 }

function Highlight({ text, query }: { text: string; query: string }) {
  const t = text ?? ""
  const q = query.trim()
  if (!q) return <>{t}</>
  const idx = t.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{t}</>
  return (
    <>
      {t.slice(0, idx)}
      <span className="font-semibold text-foreground">{t.slice(idx, idx + q.length)}</span>
      {t.slice(idx + q.length)}
    </>
  )
}

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

  // Global search state
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<GlobalSearchResult>(EMPTY)
  const [searching, setSearching] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const trimmed = query.trim()

  // ⌘K / Ctrl+K toggles the palette
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

  // Reset search state whenever the dialog closes
  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setResults(EMPTY)
      setSearchError(null)
      setSearching(false)
    }
  }, [open])

  // Debounced workspace search (≥ 2 chars)
  React.useEffect(() => {
    if (!open) return
    if (trimmed.length < 2) {
      setResults(EMPTY)
      setSearching(false)
      setSearchError(null)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const res = await globalSearchAction(workspaceSlug, trimmed)
      if (res.error) {
        setSearchError(res.error)
        setResults(EMPTY)
      } else {
        setSearchError(null)
        setResults(res.data ?? EMPTY)
      }
      setSearching(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [trimmed, workspaceSlug, open])

  function run(fn: () => void) {
    setOpen(false)
    fn()
  }

  const showResults = trimmed.length >= 2

  function gotoResult(kind: "contact" | "organization" | "deal", id: string) {
    const section =
      kind === "contact" ? "contacts" : kind === "organization" ? "organizations" : "deals"
    run(() => router.push(`/${workspaceSlug}/${section}/${id}`))
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen} title="Global search">
        <CommandPrimitive shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search contacts, companies, deals — or jump to a page…"
          />
          <CommandList>
            {searchError ? (
              <div className="px-3 py-6 text-center text-sm text-destructive">{searchError}</div>
            ) : showResults ? (
              <>
                {searching && results.total === 0 ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Searching…
                  </div>
                ) : results.total === 0 ? (
                  <CommandEmpty>No matches for &ldquo;{trimmed}&rdquo;.</CommandEmpty>
                ) : (
                  <>
                    {results.contacts.length > 0 && (
                      <CommandGroup heading="Contacts">
                        {results.contacts.map((c) => (
                          <CommandItem
                            key={`contact-${c.id}`}
                            value={`contact-${c.id}`}
                            onSelect={() => gotoResult("contact", c.id)}
                          >
                            <Users className="size-4 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">
                              <Highlight text={c.name} query={trimmed} />
                              {c.subtitle && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  <Highlight text={c.subtitle} query={trimmed} />
                                </span>
                              )}
                            </span>
                            <CornerDownLeft className="size-3 opacity-0 group-data-[selected=true]/command-item:opacity-50" />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {results.organizations.length > 0 && (
                      <CommandGroup heading="Organizations">
                        {results.organizations.map((o) => (
                          <CommandItem
                            key={`org-${o.id}`}
                            value={`org-${o.id}`}
                            onSelect={() => gotoResult("organization", o.id)}
                          >
                            <Building2 className="size-4 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">
                              <Highlight text={o.name} query={trimmed} />
                              {o.subtitle && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  <Highlight text={o.subtitle} query={trimmed} />
                                </span>
                              )}
                            </span>
                            <CornerDownLeft className="size-3 opacity-0 group-data-[selected=true]/command-item:opacity-50" />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {results.deals.length > 0 && (
                      <CommandGroup heading="Deals">
                        {results.deals.map((d) => (
                          <CommandItem
                            key={`deal-${d.id}`}
                            value={`deal-${d.id}`}
                            onSelect={() => gotoResult("deal", d.id)}
                          >
                            <KanbanSquare className="size-4 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">
                              <Highlight text={d.name} query={trimmed} />
                              {d.subtitle && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {d.subtitle}
                                </span>
                              )}
                            </span>
                            <CornerDownLeft className="size-3 opacity-0 group-data-[selected=true]/command-item:opacity-50" />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </>
                )}
              </>
            ) : null}

            {trimmed.length > 0 && trimmed.length < 2 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                Keep typing — at least 2 characters to search the workspace.
              </div>
            ) : (
              !showResults && (
                <>
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
                  <CommandSeparator />
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
                  <CommandSeparator />
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
                </>
              )
            )}
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
