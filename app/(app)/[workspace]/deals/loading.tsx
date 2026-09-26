import { Skeleton } from "@/components/ui/skeleton"

export default function DealsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-md border bg-card p-5 md:p-6 relative overflow-hidden">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        {/* Stat cards */}
        <div className="relative mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-dashed bg-muted/30 p-3 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Kanban board */}
      <div className="-mx-4 flex gap-3 overflow-hidden px-4 md:-mx-6 md:px-6">
        {Array.from({ length: 4 }).map((_, stageIdx) => (
          <div key={stageIdx} className="flex w-72 shrink-0 flex-col">
            <div className="mb-2 flex items-center gap-2 px-1">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-4" />
              <Skeleton className="h-3 w-16 ml-auto" />
            </div>
            <div className="flex min-h-24 flex-col gap-2 rounded-xl border bg-muted/40 p-2">
              {Array.from({ length: stageIdx === 0 ? 3 : stageIdx === 1 ? 2 : 1 }).map((_, cardIdx) => (
                <div key={cardIdx} className="rounded-lg border bg-card p-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
