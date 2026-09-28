import * as React from "react"

import { EmptyState as DsEmptyState, NoResultsState as DsNoResultsState } from "@/components/ds/empty"

/**
 * The app's zero state.
 *
 * This file is now a thin re-export of `components/ds/empty`, which is the
 * hand-built version (no shadcn `Button`, no `rounded-xl` icon well, no serif
 * title). It used to live here as its own implementation; keeping the old
 * module path alive matters because ~20 module pages import `EmptyState` from
 * here, and they all need to move to the new design in one step rather than
 * page by page.
 *
 * The old `icon` prop is accepted and dropped: the new empty state draws its
 * own plate, which is the whole point of it being hand-built. Passing an icon
 * through would put a coloured lucide glyph back on a canvas that has no colour.
 */

type LegacyIcon = React.ComponentType<{ className?: string; strokeWidth?: number }>

function EmptyState({
  title,
  description,
  action,
  actionHref,
  actionNode,
  secondaryAction,
  className,
  compact = false,
}: {
  /** Accepted for source compatibility; the new plate replaces it. */
  icon?: LegacyIcon
  title: React.ReactNode
  description?: React.ReactNode
  action?: { label: string; onClick?: () => void; icon?: React.ReactNode }
  actionHref?: { label: string; href: string; icon?: React.ReactNode }
  actionNode?: React.ReactNode
  secondaryAction?: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <DsEmptyState
      title={title}
      description={description}
      action={action}
      actionHref={actionHref}
      actionNode={actionNode}
      secondaryAction={secondaryAction}
      className={className}
      compact={compact}
    />
  )
}

export function NoResultsState(props: React.ComponentProps<typeof DsNoResultsState>) {
  return <DsNoResultsState {...props} />
}

export { EmptyState }
