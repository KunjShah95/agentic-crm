import { cn } from "@/lib/utils"

/**
 * Skeleton primitives for route-level `loading.tsx` files.
 *
 * Every route used to either ship a hand-rolled skeleton or ship nothing at
 * all, so eleven of fourteen screens went from a blank canvas straight to
 * content. A skeleton is not decoration: it is the thing that tells the user
 * the click registered and the data is on its way, and it is what stops the
 * layout from jumping when the real content lands.
 *
 * These mirror the real page geometry — same header height, same row rhythm,
 * same column count — because a skeleton that does not match the final layout
 * trades one kind of jank for another.
 */

function Bar({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("skeleton rounded-xs bg-muted", className)} {...props} />
}

/** Header block: title, description, and the action cluster on the right. */
export function PageHeaderSkeleton({
  withStats = false,
  actionCount = 2,
}: {
  withStats?: boolean
  actionCount?: number
}) {
  return (
    <div className="rounded-md border bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <Bar className="h-[30px] w-40" />
          <Bar className="h-3.5 w-72 max-w-[70vw]" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {Array.from({ length: actionCount }).map((_, i) => (
            <Bar key={i} className="h-8 w-24" />
          ))}
        </div>
      </div>
      {withStats ? (
        <>
          <div className="my-4 h-px bg-hairline" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-md border bg-card px-3.5 py-3">
                <Bar className="h-3 w-20" />
                <Bar className="mt-2 h-7 w-16" />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

/** The filter/search row that sits between header and data. */
export function ToolbarSkeleton({ controls = 4 }: { controls?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Bar className="h-8 min-w-52 flex-1" />
      {Array.from({ length: controls }).map((_, i) => (
        <Bar key={i} className="h-8 w-24" />
      ))}
    </div>
  )
}

/**
 * Table skeleton. `rows` should approximate the real page length — a skeleton
 * with 3 rows followed by 40 real rows reads as an error, not as loading.
 */
export function TableSkeleton({
  rows = 8,
  columns = 5,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div className={cn("overflow-hidden rounded-md border bg-card", className)}>
      <div className="flex items-center gap-4 border-b bg-surface-sunken px-4 py-2.5">
        <Bar className="h-3 w-4" />
        {Array.from({ length: columns }).map((_, i) => (
          <Bar key={i} className="h-3 w-24" />
        ))}
      </div>
      <div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex items-center gap-4 border-b border-hairline px-4 py-2.5 last:border-0"
          >
            <Bar className="h-4 w-4 shrink-0" />
            <Bar className="size-7 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Bar className="h-3.5 w-40" />
              <Bar className="h-3 w-28" />
            </div>
            {Array.from({ length: columns - 1 }).map((_, c) => (
              <Bar
                key={c}
                className={cn("hidden h-3.5 w-20 shrink-0", c < 2 && "sm:block", c < 3 && "lg:block")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** A panel with a header strip and body — the shape most dashboard cards use. */
export function CardSkeleton({
  className,
  body = 3,
}: {
  className?: string
  body?: number
}) {
  return (
    <section className={cn("overflow-hidden rounded-md border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <Bar className="h-3.5 w-32" />
        <Bar className="h-3 w-16" />
      </div>
      <div className="space-y-2.5 p-4">
        {Array.from({ length: body }).map((_, i) => (
          <Bar key={i} className="h-9 w-full" />
        ))}
      </div>
    </section>
  )
}

/** Kanban: one column skeleton per stage, matching the real board's rail. */
export function BoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="w-72 shrink-0 space-y-2">
          <Bar className="h-8 w-full rounded-md" />
          {Array.from({ length: 3 }).map((_, r) => (
            <div key={r} className="space-y-2 rounded-md border bg-card p-3">
              <Bar className="h-3.5 w-4/5" />
              <Bar className="h-3.5 w-1/2" />
              <Bar className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** A 2-column settings / detail layout. */
export function DetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-3", className)}>
      <div className="space-y-4 lg:col-span-2">
        <PageHeaderSkeleton actionCount={0} />
        <div className="space-y-4 rounded-md border bg-card p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Bar className="h-3 w-24" />
              <Bar className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <CardSkeleton body={4} />
        <CardSkeleton body={2} />
      </div>
    </div>
  )
}
