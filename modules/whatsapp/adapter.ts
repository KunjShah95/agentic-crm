/**
 * WhatsApp Meta Cloud adapter.
 *
 * Thin backwards-compatible surface over modules/whatsapp/cloud so existing
 * callers (lead auto-ack, tests) keep working while there is exactly one place
 * that knows the Graph URL, version and credential names.
 *
 * The old version silently returned `id: "wa_msg_mock_..."` when credentials
 * were missing *or when the request failed*, so the caller could not tell a
 * delivered message from a fabrication. That behaviour is gone: mocks require an
 * explicit opt-in, and real failures throw.
 */

import { renderShortcodes } from "@/modules/documents/shortcodes"
import { cloudSendText, WhatsAppApiError } from "./cloud"
import { getWhatsAppConfig, whatsappReadiness } from "./config"

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

function mockAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.WHATSAPP_ALLOW_MOCK === "true"
}

export async function sendWhatsApp({ to, body }: { to: string; body: string }): Promise<SendResult> {
  const cfg = getWhatsAppConfig()
  const readiness = whatsappReadiness(cfg)

  if (!readiness.canSend) {
    if (!mockAllowed()) {
      throw new WhatsAppApiError(`WhatsApp is not configured (missing ${readiness.missing.join(", ")})`, 0)
    }
    return { id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, mock: true, to }
  }

  const { messageId } = await cloudSendText({ to, body, phoneNumberId: cfg.phoneNumberId, token: cfg.accessToken })
  return { id: messageId, mock: false, to }
}

/** Lets callers degrade gracefully where a hard failure would be worse. */
export function isWhatsAppSendConfigured(): boolean {
  return whatsappReadiness().canSend
}
