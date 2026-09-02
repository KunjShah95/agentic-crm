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
