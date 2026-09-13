/**
 * Document context builder + renderer for RE documents (demand/allotment/
 * receipt/possession). Maps domain entities to the {{shortcode}} dictionary
 * consumed by documents/shortcodes. Pure.
 */

import { renderShortcodes } from "./shortcodes"

const inr = (n?: number | null) => (n === undefined || n === null ? "" : n.toLocaleString("en-IN"))
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v))

export type DocEntities = {
  workspace?: { name?: string; settingsJson?: { rera?: string } | null }
  project?: { name?: string; reraNo?: string | null }
  unit?: { unitNo?: string; carpetArea?: number | null; builtUp?: number | null }
  costSheet?: { basePrice?: number; gst?: number; stampDuty?: number; total?: number } | null
  contact?: { firstName?: string; lastName?: string }
  /** Ad-hoc codes (milestone, demand_amount, booking_date, receipt_no, …). */
  extra?: Record<string, string>
}

export function buildDocContext(e: DocEntities): Record<string, string> {
  const buyer = [e.contact?.firstName, e.contact?.lastName].filter(Boolean).join(" ")
  const ctx: Record<string, string> = {
    workspace_name: str(e.workspace?.name),
    rera_no: str(e.project?.reraNo ?? e.workspace?.settingsJson?.rera),
    project_name: str(e.project?.name),
    unit_no: str(e.unit?.unitNo),
    carpet_area: str(e.unit?.carpetArea),
    built_up: str(e.unit?.builtUp),
    base_price: inr(e.costSheet?.basePrice),
    gst: inr(e.costSheet?.gst),
    stamp_duty: inr(e.costSheet?.stampDuty),
    total: inr(e.costSheet?.total),
    buyer_name: buyer,
    ...(e.extra ?? {}),
  }
  return ctx
}

export function renderDocument(template: string, ctx: Record<string, string>): string {
  return renderShortcodes(template, ctx)
}

/**
 * Wrap a rendered document body in a print-ready A4 HTML shell. Used by the PDF
 * route so downloads are styled consistently regardless of the template body.
 */
export function documentPageHtml(bodyHtml: string, title = "Document"): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Georgia, serif; color: #111; line-height: 1.55; font-size: 13px; margin: 0; }
  .doc { padding: 4px 2px; }
  h1, h2, h3 { font-family: ui-sans-serif, system-ui, Arial, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 20px 0 6px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  th, td { border: 1px solid #bbb; padding: 6px 9px; text-align: left; }
  th { background: #f3f4f6; }
  .muted { color: #666; font-size: 12px; }
  .right { text-align: right; }
  .sign-row { margin-top: 48px; display: flex; justify-content: space-between; }
  .sign-box { width: 45%; border-top: 1px solid #333; padding-top: 6px; font-size: 12px; }
  hr { border: none; border-top: 2px solid #111; margin: 12px 0; }
</style></head><body><div class="doc">${bodyHtml}</div></body></html>`
}
