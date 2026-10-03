import { NextResponse } from "next/server"
import { handleUpiWebhook } from "@/modules/payments/upi"
import { createHmac, timingSafeEqual } from "crypto"

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? ""

function verifyRazorpaySignature(body: string, signature: string | null): boolean {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    // In development without a configured secret, allow through with a warning
    if (process.env.NODE_ENV !== "production") {
      console.warn("[upi webhook] No RAZORPAY_WEBHOOK_SECRET configured — skipping verification in dev")
      return true
    }
    return false
  }
  if (!signature) return false
  const expected = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex")
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-razorpay-signature")

  if (!verifyRazorpaySignature(rawBody, signature)) {
    console.error("[upi webhook] Invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const paymentId = body.paymentId ?? body.payment_id ?? body.id
  const status = body.status ?? body.event ?? "PAID"
  if (!paymentId) return NextResponse.json({ error: "Missing paymentId" }, { status: 400 })

  try {
    await handleUpiWebhook({
      paymentId: String(paymentId),
      status: String(status),
      razorpayPaymentId:
        typeof body.razorpayPaymentId === "string" ? body.razorpayPaymentId : undefined,
    })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error("[upi webhook]", e)
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
