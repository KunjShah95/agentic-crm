export const PLAN_LIMITS = {
  free: {
    maxSeats: 1,
    maxContacts: 500,
    maxSocialAccounts: 1,
    msgPerMonth: 100,
    webhookPerDay: 500,
    agentCreditsPerMo: 0,
  },
  pro: {
    maxSeats: 5,
    maxContacts: 5000,
    maxSocialAccounts: 3,
    msgPerMonth: 5000,
    webhookPerDay: 10000,
    agentCreditsPerMo: 1000,
  },
  scale: {
    maxSeats: 15,
    maxContacts: 25000,
    maxSocialAccounts: 10,
    msgPerMonth: 25000,
    webhookPerDay: 50000,
    agentCreditsPerMo: 10000,
  },
} as const

export type PlanName = keyof typeof PLAN_LIMITS
export type PlanLimits = (typeof PLAN_LIMITS)[PlanName]
