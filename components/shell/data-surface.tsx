import * as React from "react"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TableHead, TableHeader, TableRow } from "@/components/ui/table"

/**
 * Data-surface primitives.
 *
 * The recurring pattern in this app is "filter row, then a bordered card
 * containing either a table or an empty state, then a totals bar". That card
 * was being re-typed at every call site, which is how the empty branch ended
 * up rendering bare on the canvas while the loaded branch rendered inside a
 * border — so the page visibly resized the first time you got data. One
 * `DataSurface` for both branches makes that class of bug impossible.
 */

export function DataSurface({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-card",
        // Hairline containment, no shadow. Shadows are for overlays only.
        className
      )}
    >
      {children}
    </div>
  )
}

export function DataSurfaceHeader({
  title,
  meta,
  children,
  className,
}: {
  title: React.ReactNode
  meta?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* Section title: 13px/600 sans. Fraunces is reserved for the page h1
            and stat numerals — a serif at this size reads as a mistake. */}
        <h2 className="text-[13px] font-semibold leading-5 tracking-[-0.005em]">{title}</h2>
        {meta}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  )
}

/**
 * The multi-select action bar.
 *
 * It replaces two hand-typed `bg-accent/50` strips, one per table, and the
 * reason it earns a component is not dedup — it is that a selection mode needs
 * to *look* like a mode. The brand left edge is the only cue that the checkboxes
 * did something, and it is what stops the bar reading as a stray third toolbar
 * row. The count leads, because that is the first thing to check.
 */
export function BulkActionBar({
  count,
  onClear,
  children,
}: {
  count: number
  onClear: () => void
  children: React.ReactNode
}) {
  return (
    <div
      role="region"
      aria-label={`${count} contacts selected`}
      className="flex flex-wrap items-center gap-2 rounded-md border border-l-2 border-l-brand bg-brand-soft/40 px-3 py-2"
    >
      <span className="text-[13px] font-semibold tabular-nums">
        {count}
        <span className="ml-1 font-normal text-muted-foreground">
          {count === 1 ? "selected" : "selected"}
        </span>
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  )
}

/** The one table-header treatment, so every table in the app matches. */
export const TABLE_HEAD_CLASS =
  "[&_th]:h-9 [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.08em] [&_th]:text-muted-foreground"

export function DataTableHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <TableHeader className={cn(TABLE_HEAD_CLASS, className)}>
      {/* `hover:bg-transparent` — the header is a label, not a target, so it
          should not respond to the pointer the way body rows do. */}
      <TableRow className="border-b bg-surface-sunken hover:bg-surface-sunken">
        {children}
      </TableRow>
    </TableHeader>
  )
}

/**
 * A sortable column header.
 *
 * The affordance is a caret that stays at low opacity until hover. Making the
 * caret permanent on every sortable column turns the header into a row of
 * competing icons; revealing it on hover keeps the table quiet and still
 * advertises that sorting exists.
 */
export function SortableHead({
  label,
  active,
  direction,
  onSort,
  className,
  ...rest
}: {
  label: React.ReactNode
  active: boolean
  direction: "asc" | "desc" | null
  onSort: () => void
  className?: string
} & Omit<React.ComponentProps<typeof TableHead>, "children" | "onClick">) {
  const Caret = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown
  return (
    <TableHead
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn("p-0", className)}
      {...rest}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "group/sort flex h-9 w-full items-center gap-1 px-2 text-left",
          "transition-colors duration-150 hover:text-foreground",
          active && "text-foreground"
        )}
      >
        <span className="truncate">{label}</span>
        <Caret
          aria-hidden
          className={cn(
            "size-3 shrink-0 transition-opacity duration-150",
            active ? "opacity-100" : "opacity-0 group-hover/sort:opacity-60"
          )}
        />
      </button>
    </TableHead>
  )
}

/**
 * The per-row overflow menu.
 *
 * Every row carrying a permanent `⋯` button trains users to scan the table for
 * buttons instead of reading it, and on a 50-row page that is 50 buttons
 * fighting the data. Revealing on row hover keeps the table quiet, and
 * `focus-within` keeps it reachable by keyboard — a hover-only control that
 * vanishes on Tab is an accessibility bug, not a design flourish.
 */
export function RowActions({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-0.5",
        "opacity-0 transition-opacity duration-150",
        "group-hover/row:opacity-100 focus-within:opacity-100",
        // Touch has no hover. Leaving the control invisible there makes the
        // action column unreachable, so it is always shown below `sm`.
        "max-sm:opacity-100",
        className
      )}
    >
      {children}
    </div>
  )
}

/** Adds the hover-reveal contract a `RowActions` depends on. */
export const ROW_CLASS = "group/row"

/**
 * Staggered row entrance.
 *
 * Capped at 8 rows. The point is to communicate "these arrived together, in
 * order"; beyond ~8 the tail lands late enough that the animation costs more
 * than it explains, and a 200-row table would be visibly incomplete for two
 * seconds after the data was already readable.
 */
export function rowEnterStyle(index: number) {
  if (index >= 8) return undefined
  return {
    animation: "fade-in-row var(--dur-base) var(--ease-out) backwards",
    animationDelay: `${index * 22}ms`,
  } as React.CSSProperties
}
