export default function MarketingLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-6" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        <p className="text-sm text-muted-foreground">Loading Estate360…</p>
      </div>
      <span className="sr-only">Loading page</span>
    </div>
  )
}
