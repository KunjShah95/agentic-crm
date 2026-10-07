/**
 * Plan limits. These must match what the public pricing page sells
 * (`components/landing/sections/pricing.tsx`): a customer holds you to the
 * page, not to this file, so a mismatch is a broken promise.
 *
 * Internal keys are kept stable because they are stored on `Workspace.plan` and
 * `Subscription.plan`; `PLAN_LABELS` maps them to the names on the site.
 *
 *   free     after the 14-day trial lapses without a subscription
 *   builder  ₹1,499 · "1 project"                     3 seats
 *   pro      ₹3,999 · Team, "up to 6 staff"            6 seats
 *   scale    ₹7,999 · Network, "up to 12 staff"       12 seats
 *
 * Paid plans advertise "unlimited contacts and deals", so their contact quota
 * is `UNLIMITED` rather than a large number that would eventually say no.
 */
export const UNLIMITED = Number.POSITIVE_INFINITY

export const PLAN_LIMITS = {
  free: {
    maxSeats: 1,
    maxContacts: 500,
    maxSocialAccounts: 1,
    msgPerMonth: 100,
    webhookPerDay: 500,
    agentCreditsPerMo: 0,
  },
  builder: {
    maxSeats: 3,
    maxContacts: UNLIMITED,
    maxSocialAccounts: 1,
    msgPerMonth: 2000,
    webhookPerDay: 5000,
    agentCreditsPerMo: 300,
  },
  pro: {
    maxSeats: 6,
    maxContacts: UNLIMITED,
    maxSocialAccounts: 3,
    msgPerMonth: 5000,
    webhookPerDay: 10000,
    agentCreditsPerMo: 1000,
  },
  scale: {
    maxSeats: 12,
    maxContacts: UNLIMITED,
    maxSocialAccounts: 10,
    msgPerMonth: 25000,
    webhookPerDay: 50000,
    agentCreditsPerMo: 10000,
  },
} as const

export type PlanName = keyof typeof PLAN_LIMITS
export type PlanLimits = (typeof PLAN_LIMITS)[PlanName]

export const PLAN_LABELS: Record<PlanName, string> = {
  free: "Free",
  builder: "Builder",
  pro: "Team",
  scale: "Network",
}

export const PLAN_PRICES: Record<Exclude<PlanName, "free">, string> = {
  builder: "₹1,499/mo",
  pro: "₹3,999/mo",
  scale: "₹7,999/mo",
}

/** The plan a trial runs on. "Team" is the plan the pricing page recommends. */
export const TRIAL_PLAN: PlanName = "pro"
export const TRIAL_DAYS = 14

/** Subscription statuses that mean the customer is paying (or Stripe is retrying). */
const PAID_STATUSES = new Set(["active", "trialing", "past_due"])

export type EffectivePlan = {
  plan: PlanName
  /** Set while a no-card trial is running; null once paid or lapsed. */
  trialEndsAt: Date | null
  /** True when the trial ended without a subscription. */
  trialExpired: boolean
}

/**
 * The plan whose limits apply right now.
 *
 * The site promises "14 days, no card": every workspace gets Team limits for
 * fourteen days from creation, then falls back to Free until someone pays. Data
 * is never touched by the fallback, only the limits change. Derived from
 * `Workspace.createdAt`, so it needs no migration and no cron.
 */
export function resolveEffectivePlan(
  ws: { plan?: string | null; createdAt: Date },
  subscription?: { plan: string; status: string } | null,
  now: Date = new Date()
): EffectivePlan {
  if (subscription && PAID_STATUSES.has(subscription.status) && isPlanName(subscription.plan)) {
    return { plan: subscription.plan, trialEndsAt: null, trialExpired: false }
  }
  // A plan set on the workspace by hand (an invoiced customer) counts as paid.
  if (ws.plan && ws.plan !== "free" && isPlanName(ws.plan)) {
    return { plan: ws.plan, trialEndsAt: null, trialExpired: false }
  }
  const trialEndsAt = new Date(ws.createdAt.getTime() + TRIAL_DAYS * 86_400_000)
  if (now < trialEndsAt) {
    return { plan: TRIAL_PLAN, trialEndsAt, trialExpired: false }
  }
  return { plan: "free", trialEndsAt: null, trialExpired: true }
}

export function isPlanName(value: string): value is PlanName {
  return value in PLAN_LIMITS
}
