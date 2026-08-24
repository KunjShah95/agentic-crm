import { NextResponse } from "next/server"
import Stripe from "stripe"
import { stripe, handleStripeEvent } from "@/modules/billing/stripe"

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature") ?? req.headers.get("Stripe-Signature") ?? ""
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? ""

  let event: Stripe.Event
  try {
    if (secret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, secret)
    } else {
      // Fallback for local/dev/testing without webhook secret: parse body directly
      event = JSON.parse(body) as Stripe.Event
      if (!event?.type || !event?.data) {
        return new Response("Invalid event payload", { status: 400 })
      }
    }
  } catch (err) {
    const msg = (err as Error).message
    return new Response(`Webhook Error: ${msg}`, { status: 400 })
  }

  try {
    await handleStripeEvent(event)
  } catch (e) {
    console.error("[stripe webhook] handle error", e)
    return new Response("Handler error", { status: 500 })
  }

  return NextResponse.json({ received: true })
}
