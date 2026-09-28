import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The one container in the app.
 *
 * Three rules hold it together, and they are what stops a data screen from
 * turning into a grid of identical grey slabs:
 *
 *  1. **A hairline, never a shadow.** Shadows are reserved for things that
 *     float above the page (drawers, menus, tooltips). A bordered card that
 *     also has a shadow reads as a *floating* card, and once everything floats,
 *     nothing has depth and the layout goes flat.
 *  2. **8px radius, and only the outer corners.** A header row, a table, and a
 *     footer strip share one box, so the inner corners have to stay square or
 *     the seams show as notches.
 *  3. **The header is a rule, not a band.** It is 44px tall with a single
 *     hairline under it. Tinting the header (`bg-muted`) is the shadcn default
 *     and it is what makes data screens look like spreadsheets.
 */

export function Panel({
  className,
  children,
  as: As = "section",
}: {
  className?: string
  children: React.ReactNode
  as?: "section" | "div" | "article" | "aside"
}) {
  return (
    /*
     * `flex flex-col` is load-bearing, not decoration. A Panel is a grid item,
     * and grid items stretch to the tallest cell in their row — so a Panel
     * beside a taller neighbour grows. Without a column flex context the
     * content keeps its intrinsic height and the extra space becomes dead
     * white below it, which is exactly what happened to the pipeline chart:
     * a 214px chart in a 420px panel, bars at the top and nothing under them.
     * A `flex-1` child now absorbs the extra height instead.
     */
    <As
      className={cn(
        "flex flex-col overflow-hidden rounded-md border border-[#e6e6e6] bg-white",
        className
      )}
    >
      {children}
    </As>
  )
}

/**
 * A header strip: label on the left, actions on the right, one hairline below.
 *
 * `label` renders as a micro-caps caption rather than a sentence-case heading.
 * On a black-and-white canvas, the label *is* the hierarchy — a 15px semibold
 * title competes with the numbers underneath it, and a 10px wide-tracked cap
 * never does.
 */
export function PanelHeader({
  label,
  hint,
  actions,
  className,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#ededed] px-4 py-2.5",
        className
      )}
    >
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h2 className="label-caps shrink-0 text-[#0d0d0d]">{label}</h2>
        {hint ? (
          <span className="truncate text-[12px] tracking-[-0.01em] text-[#8a8a8a]">{hint}</span>
        ) : null}
      </div>
      {actions ? (
        <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div>
      ) : null}
    </div>
  )
}

/** The strip under a table: totals, record counts, footnotes. */
export function PanelFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[40px] flex-wrap items-center gap-x-5 gap-y-1 border-t border-[#ededed] bg-[#fcfcfc] px-4 py-2",
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * A label/value pair for the footer strip. The value leads in weight and the
 * label trails in colour — the inverse of the usual "grey label, black number"
 * order, because on a strip this short the eye lands on the right-most (last)
 * item and the value should already be the thing it lands on.
 */
export function FooterMetric({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: React.ReactNode
  emphasis?: boolean
}) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[12.5px] font-bold tracking-[-0.01em] tabular-nums text-[#0d0d0d]">
        {value}
      </span>
      <span className={cn("text-[12px] tracking-[-0.005em]", emphasis ? "text-[#0d0d0d]" : "text-[#8a8a8a]")}>
        {label}
      </span>
    </span>
  )
}

/** A plain hairline-divided row list — the default for feeds and key/value tables. */
export function RowList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("divide-y divide-[#f0f0f0]", className)}>{children}</div>
}
