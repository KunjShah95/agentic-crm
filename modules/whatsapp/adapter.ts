/**
 * WhatsApp Meta Cloud adapter.
 * Sends text messages via the Graph API when WHATSAPP_TOKEN + WHATSAPP_PHONE_ID
 * are configured; otherwise returns a mock result (dev / BSP-approval lag).
 * Templates reuse the {{shortcode}} render from modules/documents.
 */

import { renderShortcodes } from "@/modules/documents/shortcodes"

export const WA_TEMPLATES: Record<string, string> = {
  lead_ack:
    "Hi {{name}}, thanks for your interest in {{project}}. Our team will reach out shortly with availability and pricing. — Team {{workspace}}",
  cost_sheet:
    "Hi {{name}}, here is the cost sheet for unit {{unit_no}} at {{project}}:\n{{breakdown}}\nReply to book a site visit.",
  visit_reminder:
    "Reminder: your site visit for {{project}} is scheduled on {{date}}. See you there!",
}

export function renderWaTemplate(name: string, vars: Record<string, string>): string {
  const tpl = WA_TEMPLATES[name]
  if (!tpl) throw new Error(`Unknown WhatsApp template: ${name}`)
  return renderShortcodes(tpl, vars)
}

export function formatCostSheetMessage(sheet: {
  unitNo: string
  basePrice: number
  gst: number
  stampDuty: number
  total: number
  otherCharges?: Record<string, number>
}): string {
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`
  const lines = [
    `*Cost Sheet — Unit ${sheet.unitNo}*`,
    `Base: ${inr(sheet.basePrice)}`,
    `GST: ${inr(sheet.gst)}`,
    `Stamp Duty: ${inr(sheet.stampDuty)}`,
    ...Object.entries(sheet.otherCharges ?? {}).map(([k, v]) => `${k}: ${inr(v)}`),
    `*Total: ${inr(sheet.total)}*`,
  ]
  return lines.join("\n")
}

export type SendResult = { id: string; mock: boolean; to: string }

export async function sendWhatsApp({ to, body }: { to: string; body: string }): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) {
    return { id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, mock: true, to }
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/[^\d]/g, ""),
      type: "text",
      text: { body },
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`WhatsApp send failed: ${res.status} ${errText}`)
  }
  const data = (await res.json()) as { messages?: Array<{ id: string }> }
  return { id: data.messages?.[0]?.id ?? "", mock: false, to }
}
