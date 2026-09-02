/**
 * Email adapter (Resend).
 * Sends via the Resend API when RESEND_API_KEY + EMAIL_FROM are configured;
 * otherwise returns a mock result (dev / no provider).
 */

export type EmailResult = { id: string; mock: boolean; to: string }

export async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    return { id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, mock: true, to }
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html: body }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`Email send failed: ${res.status} ${errText}`)
  }
  const data = (await res.json()) as { id?: string }
  return { id: data.id ?? "", mock: false, to }
}
