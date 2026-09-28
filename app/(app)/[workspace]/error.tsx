"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Route-level error boundary.
 *
 * Without one, a failed server render takes the entire workspace to Next's
 * built-in error page — losing the sidebar, the topbar, and the user's place in
 * the app. The shell staying mounted is the point: recovering from a failed
 * filter is a click, not a re-login and a hunt for the URL you were on.
 *
 * `reset()` re-renders the segment without a full reload, which is the correct
 * first move for the common case here — a transient fetch or a stale form.
 * `reload` is the escape hatch when the segment itself is unrecoverable.
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [reloading, setReloading] = React.useState(false)

  React.useEffect(() => {
    // Surfaces the failure in whatever log collector is wired to the browser.
    // Without this, a client-side error is invisible outside local dev.
    console.error("[workspace] segment error", error)
  }, [error])

  function reload() {
    setReloading(true)
    window.location.reload()
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <span
        aria-hidden
        className="flex size-11 items-center justify-center rounded-md bg-status-critical-bg text-status-critical-fg"
      >
        <AlertTriangle className="size-5" strokeWidth={1.75} />
      </span>

      <div className="max-w-md space-y-2">
        <h1 className="text-balance font-display text-[30px] font-medium leading-[1.1] tracking-[-0.025em]">
          This page hit a snag
        </h1>
        <p className="text-balance text-[13px] leading-relaxed text-muted-foreground">
          The rest of your workspace is still here. Try reloading this section — if
          it keeps failing, the error code below will help pinpoint it.
        </p>
      </div>

      {error.digest ? (
        <p data-mono="id" className="font-mono text-[11px] text-muted-foreground/70">
          Reference: {error.digest}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={reload} disabled={reloading}>
          <RotateCcw data-icon="inline-start" className={reloading ? "animate-spin" : undefined} />
          Reload page
        </Button>
        <Button size="sm" onClick={reset}>
          Try again
        </Button>
      </div>

      <Link
        href="."
        className="text-[11.5px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        Back to this workspace
      </Link>
    </div>
  )
}
