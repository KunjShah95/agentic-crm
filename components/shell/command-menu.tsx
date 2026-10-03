"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import {
  Building2,
  Check,
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
import { NAV_GROUPS, NAV_SETTINGS } from "@/components/shell/nav-config"
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
import { Kbd } from "@/components/ui/kbd"

const EMPTY: GlobalSearchResult = { contacts: [], organizations: [], deals: [], total: 0 }

/** One flat page list, workspace-scoped, derived from the same config as the sidebar. */
const PAGE_JUMPS = [...NAV_GROUPS.flatMap((g) => g.items), NAV_SETTINGS]

const RESULT_ICONS = {
  contact: Users,
  organization: Building2,
  deal: KanbanSquare,
} as const

function Highlight({ text, query }: { text: string; query: string }) {
  const t = text ?? ""
  const q = query.trim()
  if (!q) return <>{t}</>
  const idx = t.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{t}</>
  return (
    <>
      {t.slice(0, idx)}
      <mark className="bg-transparent font-semibold text-foreground">{t.slice(idx, idx + q.length)}</mark>
      {t.slice(idx + q.length)}
    </>
  )
}

const ENTER_HINT = (
  <CornerDownLeft
    aria-hidden
    className="size-3.5 shrink-0 opacity-0 group-data-[selected=true]/command-item:opacity-45"
  />
)

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

  /** Mirrors the *trimmed* query so the async callback can detect that it was superseded. */
  const queryRef = React.useRef("")

  /*
   * Reset on close, driven from the change handler rather than an effect.
   *
   * The effect version read `if (!open) { setQuery(""); … }`, which is a
   * setState in an effect body — a cascading render on every close, and one
   * that fires on first mount too. Clearing at the moment the state actually
   * changes is both cheaper and the more honest place for it: the transition
   * is the cause, so the handler is where the reset belongs.
   */
  function close(next: boolean) {
    if (!next) {
      setQuery("")
      queryRef.current = ""
      setResults(EMPTY)
      setSearchError(null)
      setSearching(false)
    }
    setOpen(next)
  }

  // ⌘K / Ctrl+K toggles the palette
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        // Route through `close` so ⌘K-to-dismiss also clears the query, matching
        // the escape key and the outside click. Reading `open` from the closure
        // is safe here: the listener is re-bound on every change, so it is
        // never stale.
        close(!open)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  /*
   * Debounced workspace search, ≥ 2 chars.
   *
   * The effect owns the request and nothing else. Every state write happens
   * either in `onQueryChange` (the cause of the search) or in the async
   * callback (its consequence) — never synchronously in the effect body, which
   * would cascade a render on every keystroke.
   *
   * `queryRef` holds the **trimmed** query, not the raw one, because it is
   * compared against `requested`, which is also trimmed. It previously held the
   * raw string, so typing a trailing space made `"anjali "` !== `"anjali"`,
   * the callback bailed before setting results *and* before clearing
   * `searching` — leaving the palette spinning on "Searching…" forever with no
   * results and no error. A space is not an unusual thing to type.
   */
  React.useEffect(() => {
    if (!open || trimmed.length < 2) return
    // A stale response for a query the user has already moved past must not
    // overwrite newer results, so each request carries its own query and
    // discards itself if the live one no longer matches.
    const requested = trimmed
    const timer = setTimeout(async () => {
      const res = await globalSearchAction(workspaceSlug, requested)
      if (requested === queryRef.current) {
        if (res.error) {
          setSearchError(res.error)
          setResults(EMPTY)
        } else {
          setSearchError(null)
          setResults(res.data ?? EMPTY)
        }
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [trimmed, workspaceSlug, open])

  function run(fn: () => void) {
    close(false)
    fn()
  }

  /**
   * Every keystroke. This is where the pending flag and the "below threshold"
   * reset belong — the keystroke is what causes both, so handling them here
   * keeps the effect above purely about the network request.
   */
  function onQueryChange(next: string) {
    setQuery(next)
    queryRef.current = next.trim()
    if (next.trim().length < 2) {
      setResults(EMPTY)
      setSearching(false)
      setSearchError(null)
    } else {
      setSearching(true)
    }
  }

  const showResults = trimmed.length >= 2

  function gotoResult(kind: "contact" | "organization" | "deal", id: string) {
    const section =
      kind === "contact" ? "contacts" : kind === "organization" ? "organizations" : "deals"
    run(() => router.push(`/${workspaceSlug}/${section}/${id}`))
  }

  function resultRow(
    id: string,
    kind: keyof typeof RESULT_ICONS,
    title: string,
    subtitle: string | null | undefined
  ) {
    const Icon = RESULT_ICONS[kind]
    return (
      <CommandItem
        key={`${kind}-${id}`}
        value={`${kind}-${id}`}
        onSelect={() => gotoResult(kind, id)}
        className="gap-2.5"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          <Highlight text={title} query={trimmed} />
          {subtitle ? (
            <span className="ml-2 text-xs text-muted-foreground">
              <Highlight text={subtitle} query={trimmed} />
            </span>
          ) : null}
        </span>
        {ENTER_HINT}
      </CommandItem>
    )
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={close} title="Global search">
        <CommandPrimitive shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={onQueryChange}
            placeholder="Search contacts, companies, deals — or jump to a page…"
          />
          <CommandList>
            {searchError ? (
              <div className="px-3 py-6 text-center text-sm text-destructive">{searchError}</div>
            ) : showResults ? (
              <>
                {searching ? (
                  /*
                    While a request is in flight, dim the previous results rather
                    than blanking them. Replacing a populated list with a
                    spinner on every keystroke is the single most distracting
                    thing a search palette can do — the user loses their place
                    mid-query. The rows stay, they just stop being current.
                  */
                  <div
                    aria-live="polite"
                    aria-busy="true"
                    className="flex items-center gap-2 border-b px-3 py-1.5 text-[11px] text-muted-foreground"
                  >
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                    Searching…
                  </div>
                ) : null}
                {!searching && results.total === 0 ? (
                  <CommandEmpty>
                    No matches for &ldquo;{trimmed}&rdquo;.
                  </CommandEmpty>
                ) : (
                  <>
                    {results.contacts.length > 0 && (
                      <CommandGroup heading="Contacts">
                        {results.contacts.map((c) =>
                          resultRow(c.id, "contact", c.name, c.subtitle)
                        )}
                      </CommandGroup>
                    )}
                    {results.organizations.length > 0 && (
                      <CommandGroup heading="Organizations">
                        {results.organizations.map((o) =>
                          resultRow(o.id, "organization", o.name, o.subtitle)
                        )}
                      </CommandGroup>
                    )}
                    {results.deals.length > 0 && (
                      <CommandGroup heading="Deals">
                        {results.deals.map((d) => resultRow(d.id, "deal", d.name, d.subtitle))}
                      </CommandGroup>
                    )}
                  </>
                )}
              </>
            ) : trimmed.length > 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                Keep typing — at least 2 characters to search the workspace.
              </div>
            ) : (
              <>
                <CommandGroup heading="Go to">
                  {PAGE_JUMPS.map((item) => (
                    <CommandItem
                      key={`nav-${item.href}`}
                      value={`nav-${item.href}`}
                      onSelect={() => run(() => router.push(`/${workspaceSlug}/${item.href}`))}
                      className="gap-2.5"
                    >
                      <item.icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.hint ? (
                        <span className="shrink-0 text-xs text-muted-foreground/70">
                          {item.hint}
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Workspaces">
                  {workspaces.map((ws) => (
                    <CommandItem
                      key={ws.id}
                      value={`ws-${ws.id}`}
                      onSelect={() =>
                        run(() => {
                          void update({ activeWorkspaceId: ws.id })
                          router.push(`/${ws.slug}/dashboard`)
                        })
                      }
                      className="gap-2.5"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-xs bg-foreground text-[9px] font-bold text-background">
                        {ws.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{ws.name}</span>
                      {ws.slug === workspaceSlug && (
                        <Check className="size-3.5 shrink-0 text-brand" aria-hidden />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Appearance">
                  <CommandItem value="theme-light" onSelect={() => run(() => setTheme("light"))}>
                    <Sun className="size-4 shrink-0 text-muted-foreground" />
                    Light mode
                  </CommandItem>
                  <CommandItem value="theme-dark" onSelect={() => run(() => setTheme("dark"))}>
                    <Moon className="size-4 shrink-0 text-muted-foreground" />
                    Dark mode
                  </CommandItem>
                  <CommandItem value="theme-system" onSelect={() => run(() => setTheme("system"))}>
                    <Laptop className="size-4 shrink-0 text-muted-foreground" />
                    System theme
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </CommandPrimitive>
      </CommandDialog>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group flex h-8 w-full max-w-64 items-center gap-2 rounded-sm border bg-surface-raised px-2.5",
          "text-sm text-muted-foreground transition-colors duration-150",
          "hover:border-foreground/15 hover:bg-accent hover:text-foreground"
        )}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 text-left">Search or jump to…</span>
        {/*
          `Kbd`, not a hand-rolled <kbd>. The primitive is sans on purpose — a
          keyboard hint is chrome, and the token policy reserves mono for money,
          identifiers, and secrets. It also carries the 20px hit-target height
          and the tooltip-inversion variants the ad-hoc copy kept missing.
        */}
        <Kbd className="border">
          <span aria-hidden>⌘</span>K
        </Kbd>
      </button>
    </>
  )
}
