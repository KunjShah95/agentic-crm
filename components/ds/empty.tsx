import * as React from "react"

import { cn } from "@/lib/utils"
import { Button as DsButton, ButtonLink as DsButtonLink } from "@/components/ds/button"

/**
 * The app's zero state, written from scratch.
 *
 * A brand-new workspace is empty on *every* module on first run, so this is not
 * a fallback — it is the first thing a new user sees, several times, before they
 * have done anything. That makes it one of the highest-leverage pieces of UI in
 * the product.
 *
 * What it does, in order, and why:
 *
 *  - **Names the absence in the user's noun.** "No deals in your pipeline yet",
 *    not "No data". A generic empty state makes the user do the work of
 *    figuring out which module they are even looking at.
 *  - **Teaches the module in one sentence.** The empty screen is the only place
 *    a new user will read about what the module is for, so it says so.
 *  - **Offers exactly one primary action.** Two buttons is a decision; one is a
 *    next step.
 *  - **Draws a plate instead of dropping an icon in a grey box.** The mark below
 *    is a hairline square with a corner rule and a dot — a "target not yet hit".
 *    It gives the block a silhouette without adding a colour to a canvas that
 *    has none.
 */

export function EmptyPlate({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex size-14 items-center justify-center rounded-md",
        "border border-[#e0e0e0] bg-[#fafafa]",
        className
      )}
    >
      {/* corner rule */}
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="#c4c4c4" strokeWidth="1.4">
        <path d="M4 8.5V6a2 2 0 0 1 2-2h2.5" strokeLinecap="round" />
        <path d="M20 15.5V18a2 2 0 0 1-2 2h-2.5" strokeLinecap="round" />
      </svg>
      {/* the dot that has not been placed yet */}
      <span className="absolute size-[7px] rounded-full bg-[#dcdcdc]" />
    </span>
  )
}

export function EmptyState({
  title,
  description,
  action,
  actionHref,
  actionNode,
  secondaryAction,
  className,
  compact = false,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  /** Label + handler. Ignored when `actionHref` or `actionNode` is set. */
  action?: { label: string; onClick?: () => void; icon?: React.ReactNode }
  actionHref?: { label: string; href: string; icon?: React.ReactNode }
  /** A trigger that is itself a component (a form dialog, say). Wins over the two above. */
  actionNode?: React.ReactNode
  secondaryAction?: React.ReactNode
  className?: string
  /** Tightens it for a table cell or a narrow side panel. */
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col items-center justify-center text-center",
        compact ? "gap-3 px-4 py-9" : "gap-4 px-6 py-16",
        className
      )}
    >
      {!compact ? <EmptyPlate /> : null}

      <div className="max-w-[42ch] space-y-1.5">
        <p
          className={cn(
            "font-bold tracking-[-0.02em] text-[#0d0d0d] text-balance",
            compact ? "text-[13px]" : "text-[15px]"
          )}
        >
          {title}
        </p>
        {description ? (
          <p className="text-[13px] leading-relaxed tracking-[-0.005em] text-[#787878] text-pretty">
            {description}
          </p>
        ) : null}
      </div>

      {actionNode || action || actionHref || secondaryAction ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
          {actionNode ??
            (actionHref ? (
              <DsButtonLink size="sm" href={actionHref.href}>
                {actionHref.icon}
                {actionHref.label}
              </DsButtonLink>
            ) : action ? (
              <DsButton size="sm" onClick={action.onClick}>
                {action.icon}
                {action.label}
              </DsButton>
            ) : null)}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  )
}

/**
 * "Nothing here yet" vs. "Nothing matched".
 *
 * These are different failures and conflating them is a dead end: telling
 * someone their first deal does not exist when they actually typed a bad filter
 * is the most disorienting thing an empty state can do. The clear-filters
 * affordance appears only on the second.
 */
export function NoResultsState({
  query,
  onClear,
  className,
}: {
  query?: string
  onClear?: () => void
  className?: string
}) {
  return (
    <div className={cn("flex w-full flex-col items-center gap-3 px-4 py-14 text-center", className)}>
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full border border-dashed border-[#d8d8d8]"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="#b0b0b0" strokeWidth="1.8">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" strokeLinecap="round" />
        </svg>
      </span>
      <div className="max-w-[40ch] space-y-1">
        <p className="text-[13.5px] font-bold tracking-[-0.02em] text-[#0d0d0d]">
          {query ? <>No matches for &ldquo;{query}&rdquo;</> : "Nothing here yet"}
        </p>
        <p className="text-[12.5px] leading-relaxed text-[#8a8a8a]">
          {query
            ? "Check the spelling, or clear the search to see everything."
            : "Records will appear here once they exist."}
        </p>
      </div>
      {onClear ? (
        <DsButton variant="outline" size="sm" onClick={onClear}>
          Clear search
        </DsButton>
      ) : null}
    </div>
  )
}
