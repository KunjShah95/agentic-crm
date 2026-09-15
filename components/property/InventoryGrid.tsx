"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { formatMoneyShort } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  HOLD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  BOOKED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  SOLD: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

const STATUS_FILTERS = ["ALL", "AVAILABLE", "HOLD", "BOOKED", "SOLD"] as const

type Unit = {
  id: string
  unitNo: string
  config: string
  price?: number | null
  status: string
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
        {filtered.map((unit) => (
          <button
            key={unit.id}
            type="button"
            onClick={() => onSelect?.(unit)}
            className={cn(
              "flex flex-col gap-1 rounded-lg border p-3 text-left transition-all",
              onSelect ? "cursor-pointer hover:border-primary hover:shadow-sm" : "cursor-default"
            )}
          >
            <span className="text-sm font-semibold">{unit.unitNo}</span>
            <span className="text-xs text-muted-foreground">
              {unit.config} · {formatMoneyShort(unit.price)}
            </span>
            <span
              className={`inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLOR[unit.status] ?? "bg-gray-100 text-gray-700"}`}
            >
              {unit.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default InventoryGrid
