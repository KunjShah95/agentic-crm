import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  badge,
  actions,
  stats,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  stats?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-md border bg-card", className)}>
      <div className="relative p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[30px] font-medium leading-none tracking-[-0.025em]">{title}</h1>
              {badge ? <span className="inline-flex">{badge}</span> : null}
            </div>
            {description ? <p className="text-sm text-muted-foreground max-w-[640px] leading-relaxed">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {stats ? (
          <>
            <Separator className="my-4" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stats}</div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function Stat({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-md border bg-card px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1.5 font-display text-[28px] font-medium leading-none tracking-[-0.02em] tabular-nums">
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  )
}
