import { NextResponse } from "next/server"
import Stripe from "stripe"
import { stripe, handleStripeEvent } from "@/modules/billing/stripe"

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature") ?? req.headers.get("Stripe-Signature") ?? ""
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? ""
  const isProduction = process.env.NODE_ENV === "production"

  let event: Stripe.Event

  if (!secret) {
    if (isProduction) {
      console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET not configured in production")
      return new Response("Webhook secret not configured", { status: 500 })
    }
    // Local/dev fallback only when no secret configured and not in production (e.g. sk_test_dummy)
    try {
      event = JSON.parse(body) as Stripe.Event
      if (!event?.type || !event?.data) {
        return new Response("Invalid event payload", { status: 400 })
      }
    } catch (err) {
      console.error("[stripe webhook] Failed to parse event body", err)
      const msg = (err as Error).message
      return new Response(`Webhook Error: ${msg}`, { status: 400 })
    }
  } else if (!sig) {
    console.error("[stripe webhook] Missing stripe-signature header")
    return new Response("Missing signature", { status: 401 })
  } else {
    try {
      event = stripe.webhooks.constructEvent(body, sig, secret)
    } catch (err) {
      console.error("[stripe webhook] Signature verification failed", err)
      const msg = (err as Error).message
      return new Response(`Webhook Error: ${msg}`, { status: 400 })
    }
  }

  try {
    await handleStripeEvent(event)
  } catch (e) {
    console.error("[stripe webhook] handle error", e)
    return new Response("Handler error", { status: 500 })
  }

  return NextResponse.json({ received: true })
}
