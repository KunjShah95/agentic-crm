"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Inline error containment for a single widget.
 *
 * Distinct from `app/(app)/[workspace]/error.tsx`, which is the route-level
 * boundary. This one exists so one failing card — a chart, a health meter, a
 * lazily-hydrated panel — degrades to a small inline notice instead of taking
 * the page it sits on. On the dashboard, that is the difference between losing
 * the pipeline table and losing everything.
 *
 * It renders the raw error message because the user is already authenticated
 * into their own workspace and the message is the fastest route to a useful
 * bug report. Do not reuse this shape for anything that can surface a
 * third-party or user-authored string.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-card p-6 text-center">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-md bg-status-critical-bg text-status-critical-fg"
          >
            <AlertTriangle className="size-4" strokeWidth={1.75} />
          </span>
          <div className="max-w-xs space-y-1">
            <p className="text-[13px] font-semibold">This panel failed to load</p>
            <p className="text-balance text-[12px] leading-relaxed text-muted-foreground">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={this.reset}
          >
            <RotateCcw data-icon="inline-start" />
            Retry
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
