"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, Layers, MapPin } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ds/button"
import { SearchField } from "@/components/ds/search-field"

export type ProjectRow = {
  id: string
  name: string
  city: string
  reraNo: string | null
  unitCount: number
}

/**
 * The project listing.
 *
 * Built from scratch — no shadcn `Card`, no `Badge`, no `Button` — for three
 * reasons that are visible rather than ideological:
 *
 *  - **The card is a spec sheet, not a tile.** Real-estate inventory is
 *    compared on four numbers (units, city, RERA status, value) and a card that
 *    leads with a two-letter monogram and a "View inventory" chevron leads with
 *    nothing. This one leads with the name at 17px, then puts RERA and units on
 *    a single ruled line where they can actually be compared across cards.
 *  - **RERA is a checkbox, not a badge.** `reraNo` being non-null is a
 *    yes/no fact about a project, so it is drawn as a filled square with a
 *    tick or an empty outline — the same shape the user will see in a form.
 *    A pill that says "RERA pending" is the same information in a container
 *    that costs 40px of width.
 *  - **Search is client-side.** The list is capped at 4–20 rows and a keystroke
 *    that round-trips to Postgres to filter it is slower than the interaction
 *    it serves. A `useMemo` over an already-fetched array is the correct
 *    amount of machinery here, and the input stays controlled so the count
 *    beside it updates on the same frame as the list.
 *
 * The empty and no-match branches are genuinely different screens: "you have no
 * projects" is a setup step, "nothing matched your search" is a dead end with
 * an obvious exit. Collapsing them is the most disorienting thing a listing
 * page can do.
 */
export function ProjectListing({
  projects,
  hrefBase,
  searchable = true,
}: {
  projects: ProjectRow[]
  hrefBase: string
  /**
   * Off for the dashboard's "recent projects" strip. A filter box over three
   * items is not a control, it is a claim that there is something to filter —
   * and the `/`-to-focus shortcut it advertises would then steal a keystroke
   * on a panel with nothing to search.
   */
  searchable?: boolean
}) {
  const [query, setQuery] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) =>
      [p.name, p.city, p.reraNo ?? ""].some((field) => field.toLowerCase().includes(q))
    )
  }, [projects, query])

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-md border border-hairline bg-card px-6 py-16 text-center">
        <EmptyProjectPlate />
        <div className="max-w-[42ch] space-y-1.5">
          <p className="text-[15px] font-bold tracking-[-0.02em] text-foreground text-balance">
            No projects yet
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground text-pretty">
            A project holds your towers, units, prices, and payment plans. Add one
            and inventory becomes bookable.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {searchable ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search projects, cities, RERA numbers"
            label="Search projects"
            count={{ shown: filtered.length, total: projects.length }}
            className="w-full sm:w-[320px]"
          />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-hairline bg-surface-sunken px-6 py-14 text-center">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.7" strokeWidth="1.7" aria-hidden>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" strokeLinecap="round" />
          </svg>
          <div className="max-w-[38ch] space-y-1">
            <p className="text-[13.5px] font-bold tracking-[-0.02em] text-foreground">
              No projects match &ldquo;{query.trim()}&rdquo;
            </p>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Check the spelling, or clear the search to see all {projects.length}.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project, i) => (
            <ProjectCard key={project.id} project={project} hrefBase={hrefBase} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({
  project,
  hrefBase,
  index,
}: {
  project: ProjectRow
  hrefBase: string
  index: number
}) {
  return (
    <Link
      href={`${hrefBase}/projects/${project.id}`}
      style={
        index < 6
          ? {
              animation: "fade-in-row var(--dur-base) var(--ease-out) backwards",
              animationDelay: `${index * 24}ms`,
            }
          : undefined
      }
      className={cn(
        "group relative block overflow-hidden rounded-md border border-hairline bg-card",
        "transition-[border-color,transform] duration-150 [transition-timing-function:var(--ease-out)]",
        // No shadow on hover. The lift is a 1px rise plus a border that goes
        // from #e6e6e6 to the text colour — a card that gains a shadow on hover
        // reads as being lifted *off the page*, which is wrong for something
        // you are navigating to. This reads as being pressed *into* focus.
        "hover:-translate-y-px hover:border-foreground active:translate-y-0",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      )}
    >
      {/* The 2px black rail on the left edge, revealed on hover. It is the
          card's only decoration and it is what makes the grid feel like a
          filing system rather than a set of thumbnails. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[2px] scale-y-0 bg-foreground transition-transform duration-150 [transition-timing-function:var(--ease-out)] group-hover:scale-y-100"
      />

      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[17px] leading-[1.2] font-bold tracking-[-0.028em] text-foreground text-pretty">
            {project.name}
          </h3>
          <ArrowUpRight
            aria-hidden
            strokeWidth={2}
            className="mt-0.5 size-4 shrink-0 text-muted-foreground/60 transition-[color,transform] duration-150 group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-foreground"
          />
        </div>

        {/* Ruled fact line. `divide-x` rather than gap + borders so the rules
            stay exactly 1px and cannot double up at the edges. */}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12px] text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <ReraMark registered={Boolean(project.reraNo)} />
            {/*
              A Gujarat RERA id is a ~50-char path like
              `PR/GJ/AHMEDABAD/AHMEDABAD/CITY/AUDA/RAA09876…`, and every project
              in a city shares the same 40-character prefix — so the prefix is
              noise and the trailing registration code is the only part anyone
              compares or quotes. Showing the tail, with the whole id in the
              `title`, is the one place a truncation is an improvement rather
              than a loss of information.
            */}
            <span className="truncate" title={project.reraNo ?? undefined}>
              {shortRera(project.reraNo) ?? "RERA pending"}
            </span>
          </span>
          <span aria-hidden className="h-3 w-px bg-hairline" />
          <span className="inline-flex items-center gap-1.5">
            <Layers aria-hidden className="size-3.5" strokeWidth={1.7} />
            {project.unitCount} {project.unitCount === 1 ? "unit" : "units"}
          </span>
          {project.city ? (
            <>
              <span aria-hidden className="h-3 w-px bg-hairline" />
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden className="size-3.5" strokeWidth={1.7} />
                {project.city}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

/**
 * The registration code out of a RERA id.
 *
 * The stored value is a slash-delimited path whose last segment is the actual
 * registration number. Returns the tail, or `null` when there is no id at all —
 * the caller decides what "missing" looks like, so this never invents a
 * placeholder.
 */
function shortRera(reraNo: string | null): string | null {
  if (!reraNo) return null
  const tail = reraNo.split("/").filter(Boolean).pop()
  return tail || reraNo
}

/** Registered = a filled tick box. Not = an empty outline. Same shape either way. */
function ReraMark({ registered }: { registered: boolean }) {
  return registered ? (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden>
      <rect x="0.75" y="0.75" width="10.5" height="10.5" rx="2.5" fill="currentColor" />
      <path
        d="m3.4 6.2 1.8 1.8 3.4-3.6"
        fill="none"
        stroke="var(--card)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden>
      <rect
        x="0.75"
        y="0.75"
        width="10.5"
        height="10.5"
        rx="2.5"
        fill="none"
        stroke="var(--muted-foreground)"
        strokeOpacity="0.5"
        strokeWidth="1.4"
        strokeDasharray="2.2 1.8"
      />
    </svg>
  )
}

function EmptyProjectPlate() {
  return (
    <span
      aria-hidden
      className="relative flex size-14 items-center justify-center rounded-md border border-hairline bg-surface-sunken"
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.55" strokeWidth="1.4">
        <path d="M4 20V8.5L12 4l8 4.5V20" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 20v-6h5v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="absolute size-[7px] rounded-full bg-muted-foreground/40" />
    </span>
  )
}
