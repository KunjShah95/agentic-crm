"use client"

import { Download } from "lucide-react"

const REPORTS = [
  { id: "funnel", label: "Funnel" },
  { id: "inventory", label: "Inventory" },
  { id: "collections", label: "Collections" },
  { id: "source-roi", label: "Source ROI" },
  { id: "team", label: "Team vs Target" },
] as const

export function ExportButtons({ slug, projectId }: { slug: string; projectId?: string }) {
  const qs = projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""
  const href = (report: string, format: string) =>
    `/${slug}/reports/export?format=${format}&report=${report}${qs}`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5">
        {REPORTS.map((r) => (
          <a
            key={r.id}
            href={href(r.id, "csv")}
            download
            title={`Download ${r.label} CSV`}
            className="inline-flex items-center gap-1 rounded-lg border bg-card px-2 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Download className="size-3" /> {r.label} CSV
          </a>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <a
          href={href("all", "pdf")}
          download
          title="Download full report pack as PDF"
          className="inline-flex items-center gap-1 rounded-lg border bg-card px-2 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Download className="size-3" /> PDF
        </a>
        <a
          href={href("all", "xlsx")}
          download
          title="Download full report pack as Excel"
          className="inline-flex items-center gap-1 rounded-lg border bg-card px-2 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Download className="size-3" /> Excel
        </a>
      </div>
    </div>
  )
}
