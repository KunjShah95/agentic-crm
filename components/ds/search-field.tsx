"use client"

import * as React from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The search field, written from scratch.
 *
 * Why not `Input` from `components/ui`: the shadcn input is a rounded-lg box
 * with a `focus:ring-3` glow, and both of those are wrong for a black-and-white
 * system. The glow is a *second* affordance competing with the border — this
 * field instead turns the border itself black and lets the field grow a hair
 * taller on focus, so the change is a physical event rather than a light show.
 *
 * Three details that are most of the quality:
 *
 *  - **`⌘K` / `/` focus.** A search field you have to click is a search field
 *    most people never use. The hint chip is real: it is what teaches the
 *    shortcut, and the listener makes it true.
 *  - **The clear button is a 20px target that is 20px *visible*.** It only
 *    appears once there is something to clear, and it never moves the field's
 *    content — it occupies the same slot the icon does, so the input does not
 *    reflow on the first keystroke.
 *  - **Escape clears, and only when focused.** Escape is a global dialog/drawer
 *    affordance; swallowing it here would break the sheet and command menu
 *    stacked above the page.
 */
export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  /** Live result count, shown on the right so the user knows it is filtering. */
  count,
  className,
  autoFocus = false,
  label = "Search",
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  count?: { shown: number; total: number }
  className?: string
  autoFocus?: boolean
  label?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [focused, setFocused] = React.useState(false)

  // "/" focuses from anywhere, and ⌘K / Ctrl-K matches the app's command menu
  // so the two shortcuts do not disagree with each other.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typingElsewhere =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)

      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        return
      }
      if (event.key === "/" && !typingElsewhere && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div className={cn("relative", className)}>
      <label htmlFor="ds-search" className="sr-only">
        {label}
      </label>

      <Search
        aria-hidden
        strokeWidth={1.8}
        className={cn(
          "pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2",
          "transition-colors duration-150",
          focused ? "text-foreground" : "text-muted-foreground"
        )}
      />

      <input
        id="ds-search"
        ref={inputRef}
        type="search"
        role="searchbox"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          // Only when this field holds the value — see the note above about
          // Escape belonging to whatever is layered on top of the page.
          if (e.key === "Escape" && value) {
            e.stopPropagation()
            onChange("")
          }
        }}
        className={cn(
          "h-9 w-full rounded-sm border bg-card pr-20 pl-9",
          "text-[13px] tracking-[-0.01em] text-foreground placeholder:text-muted-foreground",
          "transition-[border-color,height,box-shadow] duration-150",
          "[transition-timing-function:var(--ease-out)]",
          // `appearance-none` + no webkit cancel button: the native clear glyph
          // is unstyleable and would sit next to ours.
          "appearance-none [&::-webkit-search-cancel-button]:hidden",
          focused
            ? "border-foreground"
            : "border-hairline hover:border-muted-foreground/50"
        )}
      />

      <span className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1.5">
        {count ? (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {count.shown}
            <span className="text-muted-foreground/50">/{count.total}</span>
          </span>
        ) : null}

        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("")
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
            className={cn(
              "flex size-5 items-center justify-center rounded-xs text-muted-foreground",
              "transition-colors duration-150 hover:bg-foreground hover:text-background",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            )}
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        ) : (
          // A keyboard hint, not decoration. It is the only affordance that
          // teaches the shortcut, so it sits inside the field where the eye
          // already is rather than in a tooltip.
          <kbd
            aria-hidden
            className="hidden rounded-xs border border-hairline bg-surface-sunken px-1.5 py-0.5 font-sans text-[10px] font-bold tracking-[0.02em] text-muted-foreground sm:block"
          >
            /
          </kbd>
        )}
      </span>
    </div>
  )
}

/**
 * A row of mutually exclusive filters.
 *
 * Not a `Tabs`: a tab set implies navigation (the URL changes, the panel is a
 * page), while these change what the panel *contains*. The difference matters —
 * users reach for tabs when they expect to come back, and a segmented control
 * when they expect to stay.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "sm",
}: {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (next: T) => void
  className?: string
  size?: "sm" | "md"
}) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm border border-hairline bg-surface-sunken p-0.5",
        className
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            className={cn(
              "flex items-center gap-1.5 rounded-xs font-bold tracking-[-0.01em]",
              "transition-colors duration-150",
              size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[12.5px]",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-card hover:text-foreground"
            )}
          >
            {opt.label}
            {opt.count != null ? (
              <span className={cn("tabular-nums", selected ? "text-primary-foreground/60" : "text-muted-foreground/60")}>
                {opt.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
