import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Reference-style win-probability heat bar: ten segments filled proportionally
 * to `value` (0–100). Theme-agnostic — filled segments carry the brand accent,
 * empty segments fall back to the border token so it reads in light and dark.
 */
export function WinBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-sm text-muted-foreground/50">—</span>
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * 10)
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-[3px]" aria-hidden>
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-3.5 w-[3px] rounded-full transition-colors",
              i < filled ? "bg-brand" : "bg-border"
            )}
          />
        ))}
      </div>
      <span className="text-sm font-medium tabular-nums">{value}%</span>
    </div>
  )
}

type Tagged = { tag: { id: string; name: string; color: string } }

/** Colored tag chips, mirroring the reference's inline Segment & Stage column. */
export function TagPills({ tags, max = 3 }: { tags?: Tagged[]; max?: number }) {
  if (!tags?.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.slice(0, max).map(({ tag }) => (
        <span
          key={tag.id}
          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: `${tag.color}1a`,
            color: tag.color,
            boxShadow: `inset 0 0 0 1px ${tag.color}33`,
          }}
        >
          {tag.name}
        </span>
      ))}
      {tags.length > max && (
        <span className="text-[10px] font-medium text-muted-foreground">+{tags.length - max}</span>
      )}
    </div>
  )
}

/** Sticky aggregation bar rendered under a table, like the reference footer. */
export function TableTotalsBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t bg-muted/40 px-4 py-2.5 text-xs">
      {children}
    </div>
  )
}

/** A single "Label value" metric inside a TableTotalsBar. */
export function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="text-muted-foreground">
      {label} <span className="font-medium text-foreground tabular-nums">{value}</span>
    </span>
  )
}
