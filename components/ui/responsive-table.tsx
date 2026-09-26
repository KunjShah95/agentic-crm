"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Renders children on desktop, shows a card-based fallback on mobile.
 * Usage:
 * <ResponsiveTable desktop={<Table>...</Table>} mobile={<div>cards</div>} />
 */
export function ResponsiveTable({
  desktop,
  mobile,
  className,
}: {
  desktop: React.ReactNode
  mobile: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <div className="hidden sm:block">{desktop}</div>
      <div className="block sm:hidden">{mobile}</div>
    </div>
  )
}

/**
 * A mobile-friendly card row for use inside the mobile slot.
 */
export function MobileCard({
  children,
  href,
  className,
}: {
  children: React.ReactNode
  href?: string
  className?: string
}) {
  const Wrapper = href ? "a" : "div"
  return (
    <Wrapper
      href={href}
      className={cn(
        "block rounded-xl border bg-card p-3 transition-colors",
        href && "hover:border-foreground/20",
        className
      )}
    >
      {children}
    </Wrapper>
  )
}

/**
 * Mobile card row with standard layout: primary text, secondary text, and optional actions.
 */
export function MobileCardRow({
  primary,
  secondary,
  meta,
  actions,
  href,
}: {
  primary: React.ReactNode
  secondary?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
  href?: string
}) {
  return (
    <MobileCard href={href}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{primary}</div>
          {secondary && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{secondary}</div>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {meta && <div className="mt-2 flex flex-wrap gap-1.5">{meta}</div>}
    </MobileCard>
  )
}
