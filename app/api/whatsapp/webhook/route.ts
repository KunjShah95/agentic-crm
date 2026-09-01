import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { recordInboundWhatsApp } from "@/modules/whatsapp/actions"

export const dynamic = "force-dynamic"

/**
 * Meta WhatsApp Cloud webhook verification (GET) — echoes hub.challenge when
 * the verify token matches WHATSAPP_VERIFY_TOKEN.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")
  const expected = process.env.WHATSAPP_VERIFY_TOKEN ?? "dev-verify"
  if (mode === "subscribe" && token === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } })
  }
  return new Response("Forbidden", { status: 403 })
}

type WaChange = {
  value?: {
    metadata?: { phone_number_id?: string }
    messages?: Array<{ from?: string; text?: { body?: string } }>
  }
}

/**
 * Inbound messages. Resolves the tenant by matching the receiving
 * phone_number_id to Workspace.settingsJson.whatsappPhoneId. Always 200.
 */
export async function POST(req: Request) {
  let body: { entry?: Array<{ changes?: WaChange[] }> } = {}
  try {
    body = JSON.parse(await req.text())
  } catch {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const phoneId = change.value?.metadata?.phone_number_id
        const messages = change.value?.messages ?? []
        if (!phoneId || !messages.length) continue

        const ws = await db.workspace.findFirst({
          where: { settingsJson: { path: ["whatsappPhoneId"], equals: phoneId } },
          select: { id: true },
        })
        if (!ws) continue

        for (const m of messages) {
          if (m.from && m.text?.body) {
            await recordInboundWhatsApp({ workspaceId: ws.id, from: m.from, body: m.text.body })
          }
        }
      }
    }
  } catch (e) {
    console.error("[whatsapp:webhook] process error", e)
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
