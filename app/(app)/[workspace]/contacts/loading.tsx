import { Skeleton } from "@/components/ui/skeleton"

export default function ContactsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-[20px] border bg-card p-5 md:p-6 relative overflow-hidden">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 flex-1 min-w-56" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-24 hidden sm:block" />
              <Skeleton className="h-4 w-20 hidden md:block" />
              <Skeleton className="h-4 w-16 hidden lg:block" />
              <Skeleton className="h-4 w-16 hidden lg:block" />
              <Skeleton className="h-4 w-20 hidden sm:block" />
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
