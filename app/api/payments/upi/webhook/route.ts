import { NextResponse } from "next/server"
import { handleUpiWebhook } from "@/modules/payments/upi"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const paymentId = body.paymentId ?? body.payment_id ?? body.id
  const status = body.status ?? body.event ?? "PAID"
  if (!paymentId) return NextResponse.json({ error: "Missing paymentId" }, { status: 400 })
  try {
    await handleUpiWebhook({ paymentId: String(paymentId), status: String(status), razorpayPaymentId: body.razorpayPaymentId })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error("[upi webhook]", e)
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
