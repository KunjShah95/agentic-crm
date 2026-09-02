/**
 * SMS adapter (Twilio).
 * Sends via the Twilio REST API when TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN +
 * TWILIO_FROM are configured; otherwise returns a mock result (dev / no BSP).
 */

export type SmsResult = { id: string; mock: boolean; to: string }

export async function sendSms({ to, body }: { to: string; body: string }): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM
  if (!sid || !token || !from) {
    return { id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, mock: true, to }
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64")
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`SMS send failed: ${res.status} ${errText}`)
  }
  const data = (await res.json()) as { sid?: string }
  return { id: data.sid ?? "", mock: false, to }
}
