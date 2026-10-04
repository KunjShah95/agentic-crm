"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { formatMoneyShort, timeUntil } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "bg-status-positive-bg text-status-positive-fg",
  HOLD: "bg-status-caution-bg text-status-caution-fg",
  BOOKED: "bg-status-info-bg text-status-info-fg",
  SOLD: "bg-status-critical-bg text-status-critical-fg",
}

const STATUS_FILTERS = ["ALL", "AVAILABLE", "HOLD", "BOOKED", "SOLD"] as const

type Unit = {
  id: string
  unitNo: string
  config: string
  price?: number | null
  status: string
  /** The fields below are all in the Prisma `Unit` model; optional here because
      callers pass projections. When present the tile shows them, because they
      are the questions this market actually asks. */
  carpetArea?: number | null
  facing?: string | null
  holdUntil?: string | Date | null
}

export function InventoryGrid({
  units,
  onSelect,
}: {
  units: Unit[]
  onSelect?: (unit: Unit) => void
}) {
  const [query, setQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")

  /* "Now" is captured once per mount and never recomputed. Reading `Date.now()`
     in the render body is an impure read — it makes the output depend on when
     React happened to render, which is exactly the class of bug that shows up as
     a hydration mismatch and as tiles that disagree with each other. The hold
     treatment is not a live clock (see `timeUntil`); it only needs a stable
     reference point for the life of this view. */
  const [now] = React.useState(() => Date.now())

  const filtered = React.useMemo(() => {
    return units.filter((unit) => {
      const matchesQuery = !query || unit.unitNo.toLowerCase().includes(query.toLowerCase()) || unit.config.toLowerCase().includes(query.toLowerCase())
      const matchesStatus = statusFilter === "ALL" || unit.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [units, query, statusFilter])

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { ALL: units.length, AVAILABLE: 0, HOLD: 0, BOOKED: 0, SOLD: 0 }
    for (const u of units) {
      if (c[u.status] !== undefined) c[u.status]++
    }
    return c
  }, [units])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 max-w-sm">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search unit number…"
            className="pl-8"
          />
        </div>
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === status
                  ? "bg-foreground text-background border-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
              <span className="tabular-nums">{counts[status]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {filtered.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
            No units match your search.
          </div>
        )}
        {filtered.map((unit) => {
          // The hold is the only deadline attached to a unit, and it is the one
          // thing on this card that can change on its own while the user is
          // looking at it. Two states, not a colour gradient: lapsed holds are
          // recoverable (release it), imminent ones are not (act now).
          const hold = unit.holdUntil ? new Date(unit.holdUntil).getTime() : null
          const msToLapse = hold === null ? null : hold - now
          const holdLapsed = msToLapse !== null && msToLapse <= 0
          const holdImminent = msToLapse !== null && msToLapse > 0 && msToLapse < 2 * 60 * 60 * 1000

          return (
          <button
            key={unit.id}
            type="button"
            onClick={() => onSelect?.(unit)}
            className={cn(
              // `.pressable` supplies the press half of the trigger→feedback
              // pair. A raw <button> gets none of the Button primitive's
              // `active:` treatment, so before this the only acknowledgement of
              // a tap was the click landing — on a 40-tile grid that reads as
              // an unresponsive surface.
              "pressable flex flex-col gap-1.5 rounded-md border p-3 text-left transition-[border-color,box-shadow]",
              onSelect ? "cursor-pointer hover:border-primary hover:shadow-sm" : "cursor-default"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold">{unit.unitNo}</span>
              <span
                className={`inline-flex w-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLOR[unit.status] ?? "bg-status-neutral-bg text-status-neutral-fg"}`}
              >
                {unit.status}
              </span>
            </div>

            <span className="text-xs text-muted-foreground">
              {unit.config}
              {/* Carpet area, not a bare "area". In Indian residential the
                  built-up figure is what gets advertised and the carpet figure
                  is what the buyer actually gets, and the gap between them is a
                  routine source of disputes — so the tile shows the one the
                  sales conversation needs. */}
              {unit.carpetArea ? ` · ${unit.carpetArea} sq.ft carpet` : ""}
              {/* Facing decides resale value in this market and is the second
                  most-asked question after price. */}
              {unit.facing ? ` · ${unit.facing}` : ""}
            </span>

            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium tabular-nums">
                {formatMoneyShort(unit.price)}
              </span>
              {unit.status === "HOLD" && unit.holdUntil ? (
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    holdLapsed
                      ? "font-medium text-status-critical-fg"
                      : holdImminent
                        ? "font-medium text-status-caution-fg"
                        : "text-muted-foreground"
                  )}
                >
                  {holdLapsed ? `Hold lapsed ${timeUntil(unit.holdUntil)}` : `Hold ${timeUntil(unit.holdUntil)}`}
                </span>
              ) : null}
            </div>
          </button>
          )
        })}
      </div>
    </div>
  )
}

export default InventoryGrid
