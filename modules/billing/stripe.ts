import Stripe from "stripe"
import { db } from "@/lib/db"
import { type PlanName } from "./limits"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_dummy", {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: "2024-06-20" as any,
})

export const PRICE_TO_PLAN: Record<string, PlanName> = {
  [process.env.STRIPE_PRICE_PRO ?? "price_pro_xxx"]: "pro",
  [process.env.STRIPE_PRICE_SCALE ?? "price_scale_xxx"]: "scale",
}

export function mapStripePlan(priceId: string): PlanName {
  if (!priceId) return "free"
  const mapped = PRICE_TO_PLAN[priceId]
  if (mapped) return mapped
  // Fallback heuristics: handle legacy hardcoded ids or substring matches
  if (priceId === "price_pro" || priceId.includes("price_pro_")) return "pro"
  if (priceId === "price_scale" || priceId.includes("price_scale_")) return "scale"
  return "free"
}

async function syncWorkspacePlan(workspaceId: string, plan: PlanName) {
  await db.workspace.update({ where: { id: workspaceId }, data: { plan } })
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const workspaceId = (session.client_reference_id as string | null) ?? (session.metadata?.workspaceId as string | null) ?? null
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : ((session.customer as unknown as { id: string } | null)?.id ?? null)
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : ((session.subscription as unknown as { id: string } | null)?.id ?? null)

      let workspace: { id: string } | null = null
      if (workspaceId) {
        workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } })
      }
      if (!workspace && customerId) {
        const sub = await db.subscription.findUnique({ where: { stripeCustomerId: customerId }, select: { workspaceId: true } })
        if (sub) workspace = { id: sub.workspaceId }
      }
      if (!workspace) return

      let plan: PlanName = "pro"
      if (subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          const priceId = sub.items?.data?.[0]?.price?.id ?? ""
          if (priceId) plan = mapStripePlan(priceId)
        } catch {
          // ignore retrieve failures (e.g. dummy key in tests)
        }
      }

      const status = "active"
      await db.subscription.upsert({
        where: { workspaceId: workspace.id },
        create: {
          workspaceId: workspace.id,
          stripeCustomerId: customerId ?? `cus_unknown_${workspace.id}`,
          stripeSubId: subscriptionId ?? undefined,
          plan,
          status,
        },
        update: {
          stripeCustomerId: customerId ?? undefined,
          stripeSubId: subscriptionId ?? undefined,
          plan,
          status,
        },
      })
      await syncWorkspacePlan(workspace.id, plan)
      break
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      const customerId = typeof sub.customer === "string" ? sub.customer : ((sub.customer as unknown as { id: string }).id ?? "")
      const priceId = sub.items?.data?.[0]?.price?.id ?? ""
      const plan: PlanName = priceId ? mapStripePlan(priceId) : "pro"
      const status = sub.status ?? "active"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cpe = (sub as any).current_period_end as number | undefined
      const currentPeriodEnd = cpe ? new Date(cpe * 1000) : null

      // Find workspace by stripeCustomerId or stripeSubId
      let existing = await db.subscription.findUnique({ where: { stripeCustomerId: customerId } })
      if (!existing && sub.id) {
        existing = await db.subscription.findUnique({ where: { stripeSubId: sub.id } })
      }
      if (!existing) {
        // Try findFirst as fallback
        existing = await db.subscription.findFirst({ where: { OR: [{ stripeCustomerId: customerId }, { stripeSubId: sub.id }] } })
      }
      if (!existing) return

      const workspaceId = existing.workspaceId
      await db.subscription.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          stripeCustomerId: customerId,
          stripeSubId: sub.id,
          plan,
          status,
          currentPeriodEnd: currentPeriodEnd ?? undefined,
        },
        update: {
          stripeCustomerId: customerId,
          stripeSubId: sub.id,
          plan,
          status,
          currentPeriodEnd: currentPeriodEnd ?? undefined,
        },
      })
      await syncWorkspacePlan(workspaceId, plan)
      break
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      const customerId = typeof sub.customer === "string" ? sub.customer : ((sub.customer as unknown as { id: string }).id ?? "")
      let existing = await db.subscription.findUnique({ where: { stripeCustomerId: customerId } })
      if (!existing && sub.id) {
        existing = await db.subscription.findUnique({ where: { stripeSubId: sub.id } })
      }
      if (!existing) {
        existing = await db.subscription.findFirst({ where: { OR: [{ stripeCustomerId: customerId }, { stripeSubId: sub.id }] } })
      }
      if (!existing) return

      const workspaceId = existing.workspaceId
      await db.subscription.update({
        where: { workspaceId },
        data: {
          stripeSubId: null,
          plan: "free",
          status: "canceled",
        },
      })
      await syncWorkspacePlan(workspaceId, "free")
      break
    }

    default:
      return
  }
}
