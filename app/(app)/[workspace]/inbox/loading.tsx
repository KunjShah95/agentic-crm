import { Skeleton } from "@/components/ui/skeleton"

/**
 * The inbox loads its contact list and the selected thread before it can render
 * anything, so the shell holds the full-height two-pane layout rather than
 * collapsing to a single centred block — otherwise the page jumps from a narrow
 * column to a full-width split on every navigation.
 */
export default function InboxLoading() {
  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-md border bg-card md:h-[calc(100vh-4rem)] md:flex-row">
      <aside className="w-full shrink-0 overflow-hidden border-b bg-muted/20 md:block md:w-80 md:border-r md:border-b-0">
        <div className="flex items-center justify-between border-b bg-card/80 px-4 py-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-8 rounded-full" />
        </div>
        <div className="hidden gap-1 border-b bg-card/50 px-4 py-2 md:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-md" />
          ))}
        </div>
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2 border-b px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-8 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          ))}
        </div>
      </aside>

      <section className="min-h-0 flex-1 overflow-hidden p-4">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`flex ${i % 3 === 0 ? "justify-end" : "justify-start"}`}>
              <Skeleton className="h-12 w-2/5 rounded-md" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}