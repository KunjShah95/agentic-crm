import { PageHeaderSkeleton } from "@/components/shell/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Composed here rather than reusing `ListModuleLoading`.
 *
 * That skeleton renders header + toolbar + table, which is the shape of the
 * Documents tab. The default tab on this route is Ask, so a table skeleton would
 * show the user rows of a table that is not what loads — the layout swaps to a
 * card and a question box a moment later, and the skeleton is the one thing on
 * screen that made a promise the page then broke.
 *
 * So this mirrors the actual first paint: header, the tab pair, then the card the
 * Ask panel lives in.
 */
export default function KnowledgeLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton withStats={false} actionCount={0} />

      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      <div className="space-y-4 rounded-md border bg-card p-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3.5 w-72 max-w-[80vw]" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </div>
  )
}
