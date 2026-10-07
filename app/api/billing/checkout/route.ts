import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { priceIdForPlan, stripe } from "@/modules/billing/stripe"

export async function POST(req: Request) {
  const session = await auth()
  const userId = (session?.user as unknown as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  const workspaceId = (body.workspaceId ?? body.workspace_id) as string | undefined
  const planParam = body.plan as string | undefined
  const priceIdParam = body.priceId as string | undefined

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 })
  }

  try {
    await requireWorkspaceMember(workspaceId, userId, "ADMIN")
  } catch (e) {
    const msg = (e as Error).message
    const status = (e as { status?: number }).status ?? 403
    return NextResponse.json({ error: msg }, { status })
  }

  /* Plan name in, env price out. The route used to accept a raw `priceId` from
     the browser and allow anything starting with "price_", so a signed-in admin
     could check out on any price in the Stripe account (an old discount, a test
     price) and still be mapped to a paid plan. Only the three configured plan
     prices are reachable now; `priceId` is honoured only if it is one of them. */
  const configured = new Set(
    [process.env.STRIPE_PRICE_BUILDER, process.env.STRIPE_PRICE_PRO, process.env.STRIPE_PRICE_SCALE].filter(
      Boolean
    ) as string[]
  )
  const priceId =
    (priceIdParam && configured.has(priceIdParam) ? priceIdParam : null) ??
    priceIdForPlan(planParam ?? "pro")
  if (!priceId) {
    return NextResponse.json(
      { error: "Billing is not configured for this plan yet. Contact support to upgrade." },
      { status: 503 }
    )
  }

  const existing = await db.subscription.findUnique({ where: { workspaceId } })
  const customerId = existing?.stripeCustomerId ?? null

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { slug: true } })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000"
  const slugOrId = workspace?.slug ?? workspaceId
  const successUrl = `${baseUrl}/${slugOrId}/settings/billing?success=1`
  const cancelUrl = `${baseUrl}/${slugOrId}/settings/billing?canceled=1`

  try {
    const stripeSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: workspaceId,
      customer: customerId ?? undefined,
      customer_creation: customerId ? undefined : "always",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    })
    return NextResponse.json({ url: stripeSession.url })
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
