import { cn } from "@/lib/utils"
import {
  BoardSkeleton,
  CardSkeleton,
  DetailSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from "@/components/shell/skeletons"

function Bar({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xs bg-muted", className)} />
}

/**
 * One preset per page archetype, so a route's `loading.tsx` is a single line
 * that states which archetype it is.
 *
 * The point is that the loading state and the loaded page share a layout. If
 * they disagree, the skeleton is not a bridge — it is a second, differently
 * sized layout the user has to re-read when the real one arrives.
 */

/** Header + stat band + filter row + long table. Contacts, deals, tasks, orgs. */
export function ListModuleLoading({
  rows = 8,
  columns = 5,
  controls = 3,
}: {
  rows?: number
  columns?: number
  controls?: number
}) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withStats actionCount={1} />
      <ToolbarSkeleton controls={controls} />
      <TableSkeleton rows={rows} columns={columns} />
    </div>
  )
}

/** Header + stat band + filter row + a two-column board. Site visits, bookings. */
export function BoardModuleLoading({ columns = 4 }: { columns?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withStats actionCount={1} />
      <ToolbarSkeleton controls={3} />
      <BoardSkeleton columns={columns} />
    </div>
  )
}

/** Header + filter row + a grid of panels. Reports, documents, AI. */
export function GridModuleLoading({
  cards = 4,
  withStats = false,
  toolbar = true,
}: {
  cards?: number
  withStats?: boolean
  toolbar?: boolean
}) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withStats={withStats} actionCount={2} />
      {toolbar ? <ToolbarSkeleton controls={4} /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: Math.max(2, Math.ceil(cards / 2)) }).map((_, i) => (
          <CardSkeleton key={i} body={5} />
        ))}
      </div>
    </div>
  )
}

/** A record page: identity header, long form, side rail. Settings, detail views. */
export function RecordModuleLoading() {
  return <DetailSkeleton />
}

/**
 * The dashboard specifically: a five-tile metric band, then a wide pipeline
 * table beside a narrow side card, then a full-width activity list. The 3:1
 * split is what makes the dashboard recognisable while it loads.
 */
export function DashboardModuleLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actionCount={2} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-md border bg-card p-4">
            <Bar className="h-3 w-20" />
            <Bar className="mt-2.5 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        <TableSkeleton rows={5} columns={4} className="lg:col-span-3" />
        <CardSkeleton body={5} />
      </div>
      <CardSkeleton body={4} />
    </div>
  )
}
