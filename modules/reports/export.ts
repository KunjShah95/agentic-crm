/**
 * Lightweight exports — CSV is Excel-compatible; PDF is a print-friendly HTML
 * string the client can open in a new tab and print. If `xlsx` is installed,
 * `toExcel` will use it; otherwise it falls back to multi-sheet CSV (zip not
 * required for demo parity). Keeps deps minimal for CI.
 */

import type { FunnelRow, InventoryHealth, CollectionsSummary, SourceROIRow, TeamTargetRow } from "./aggregate"

function csv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
}

export function funnelCsv(rows: FunnelRow[]): string {
  return csv([["Stage", "Count", "Conversion %"], ...rows.map((r) => [r.stage, String(r.count), String(r.conversionPct)])])
}
export function inventoryCsv(h: InventoryHealth): string {
  return csv([
    ["Metric", "Value"],
    ["Total", String(h.total)],
    ["Available", String(h.available)],
    ["Hold", String(h.hold)],
    ["Booked", String(h.booked)],
    ["Sold", String(h.sold)],
    ["Sold %", String(h.soldPct)],
  ])
}
export function collectionsCsv(c: CollectionsSummary): string {
  return csv([
    ["Metric", "Amount"],
    ["Due", String(c.due)],
    ["Paid", String(c.paid)],
    ["Overdue", String(c.overdue)],
    ["Total", String(c.total)],
    ["Overdue %", String(c.overduePct)],
  ])
}
export function sourceROICsv(rows: SourceROIRow[]): string {
  return csv([
    ["Source", "Leads", "Bookings", "Revenue", "Conversion %"],
    ...rows.map((r) => [r.source, String(r.leads), String(r.bookings), String(r.revenue), String(r.conversionPct)]),
  ])
}
export function teamCsv(rows: TeamTargetRow[]): string {
  return csv([
    ["Owner", "Bookings", "Target", "Attainment %"],
    ...rows.map((r) => [r.ownerName, String(r.bookings), String(r.target), String(r.attainmentPct)]),
  ])
}

export type ReportId = "funnel" | "inventory" | "collections" | "source-roi" | "team" | "all"

export const REPORT_IDS: ReportId[] = ["funnel", "inventory", "collections", "source-roi", "team", "all"]

export type ReportsSnapshot = {
  funnel: FunnelRow[]
  inventory: InventoryHealth
  collections: CollectionsSummary
  sourceROI: SourceROIRow[]
  teamVsTarget: TeamTargetRow[]
}

export function reportCsv(
  report: Exclude<ReportId, "all">,
  snapshot: ReportsSnapshot,
): string {
  switch (report) {
    case "funnel":
      return funnelCsv(snapshot.funnel)
    case "inventory":
      return inventoryCsv(snapshot.inventory)
    case "collections":
      return collectionsCsv(snapshot.collections)
    case "source-roi":
      return sourceROICsv(snapshot.sourceROI)
    case "team":
      return teamCsv(snapshot.teamVsTarget)
  }
}

export function reportFilename(report: ReportId, ext: "csv" | "xlsx", slug: string): string {
  return `reports-${slug}-${report}.${ext}`
}

export function buildReportsCsv(snapshot: {
  funnel: FunnelRow[]
  inventory: InventoryHealth
  collections: CollectionsSummary
  sourceROI: SourceROIRow[]
  teamVsTarget: TeamTargetRow[]
}): string {
  return [
    "# Funnel",
    funnelCsv(snapshot.funnel),
    "",
    "# Inventory Health",
    inventoryCsv(snapshot.inventory),
    "",
    "# Collections",
    collectionsCsv(snapshot.collections),
    "",
    "# Source ROI",
    sourceROICsv(snapshot.sourceROI),
    "",
    "# Team vs Target",
    teamCsv(snapshot.teamVsTarget),
  ].join("\n")
}

export function buildReportsHtml(snapshot: {
  funnel: FunnelRow[]
  inventory: InventoryHealth
  collections: CollectionsSummary
  sourceROI: SourceROIRow[]
  teamVsTarget: TeamTargetRow[]
  workspaceName: string
  generatedAt: string
}): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  return `<!doctype html><html><head><meta charset="utf-8"><title>Reports — ${esc(snapshot.workspaceName)}</title>
<style>body{font-family: ui-sans-serif,system-ui; padding:32px; color:#111} h1{font-size:20px} h2{margin-top:28px;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#555} table{border-collapse:collapse;width:100%;margin-top:8px} th,td{border:1px solid #ddd;padding:8px 10px;text-align:left;font-size:13px} th{background:#f6f6f6;font-weight:600} .muted{color:#666;font-size:12px}</style>
</head><body>
<h1>Reports — ${esc(snapshot.workspaceName)}</h1><div class="muted">Generated ${esc(snapshot.generatedAt)}</div>
<h2>Funnel</h2><table><tr><th>Stage</th><th>Count</th><th>Conversion %</th></tr>${snapshot.funnel.map((r) => `<tr><td>${esc(r.stage)}</td><td>${r.count}</td><td>${r.conversionPct}</td></tr>`).join("")}</table>
<h2>Inventory Health</h2><table><tr><th>Metric</th><th>Value</th></tr><tr><td>Total</td><td>${snapshot.inventory.total}</td></tr><tr><td>Available</td><td>${snapshot.inventory.available}</td></tr><tr><td>Hold</td><td>${snapshot.inventory.hold}</td></tr><tr><td>Booked</td><td>${snapshot.inventory.booked}</td></tr><tr><td>Sold</td><td>${snapshot.inventory.sold}</td></tr><tr><td>Sold %</td><td>${snapshot.inventory.soldPct}</td></tr></table>
<h2>Collections</h2><table><tr><th>Due</th><th>Paid</th><th>Overdue</th><th>Total</th><th>Overdue %</th></tr><tr><td>${snapshot.collections.due}</td><td>${snapshot.collections.paid}</td><td>${snapshot.collections.overdue}</td><td>${snapshot.collections.total}</td><td>${snapshot.collections.overduePct}</td></tr></table>
<h2>Source ROI</h2><table><tr><th>Source</th><th>Leads</th><th>Bookings</th><th>Revenue</th><th>Conversion %</th></tr>${snapshot.sourceROI.map((r) => `<tr><td>${esc(r.source)}</td><td>${r.leads}</td><td>${r.bookings}</td><td>${r.revenue}</td><td>${r.conversionPct}</td></tr>`).join("")}</table>
<h2>Team vs Target</h2><table><tr><th>Owner</th><th>Bookings</th><th>Target</th><th>Attainment %</th></tr>${snapshot.teamVsTarget.map((r) => `<tr><td>${esc(r.ownerName)}</td><td>${r.bookings}</td><td>${r.target}</td><td>${r.attainmentPct}</td></tr>`).join("")}</table>
<script>window.print()</script>
</body></html>`
}

/**
 * Single Excel workbook — one sheet per report, so the user gets the whole
 * pack in one download. Server-only (node buffer).
 */
export function buildReportsWorkbook(snapshot: ReportsSnapshot): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx")
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Stage", "Count", "Conversion %"],
      ...snapshot.funnel.map((r) => [r.stage, r.count, r.conversionPct]),
    ]),
    "Funnel",
  )
  const inv = snapshot.inventory
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Metric", "Value"],
      ["Total", inv.total],
      ["Available", inv.available],
      ["Hold", inv.hold],
      ["Booked", inv.booked],
      ["Sold", inv.sold],
      ["Sold %", inv.soldPct],
    ]),
    "Inventory",
  )
  const c = snapshot.collections
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Metric", "Amount"],
      ["Due", c.due],
      ["Paid", c.paid],
      ["Overdue", c.overdue],
      ["Total", c.total],
      ["Overdue %", c.overduePct],
    ]),
    "Collections",
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Source", "Leads", "Bookings", "Revenue", "Conversion %"],
      ...snapshot.sourceROI.map((r) => [r.source, r.leads, r.bookings, r.revenue, r.conversionPct]),
    ]),
    "Source ROI",
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Owner", "Bookings", "Target", "Attainment %"],
      ...snapshot.teamVsTarget.map((r) => [r.ownerName, r.bookings, r.target, r.attainmentPct]),
    ]),
    "Team vs Target",
  )
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Uint8Array)
}
