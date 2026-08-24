import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatDate } from "@/lib/format"
import { canManageBilling } from "@/lib/permissions"
import { PLAN_LIMITS, type PlanName } from "@/modules/billing/limits"
import { periodKey, periodKeyFor } from "@/modules/billing/quota"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { QuotaBars } from "@/components/billing/quota-bars"
import { PlanCard } from "@/components/billing/plan-card"

export const metadata: Metadata = { title: "Billing settings" }

export default async function BillingSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>
}) {
  const { workspace: slug } = await params
  const session = await auth()

  const workspace = await db.workspace.findUnique({
    where: { slug },
  })
  if (!workspace) notFound()

  const membership = session?.user?.id
    ? await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: session.user.id,
          },
        },
      })
    : null
  if (!membership) notFound()

  const subscription = await db.subscription.findUnique({
    where: { workspaceId: workspace.id },
  })

  const plan = (subscription?.plan ?? workspace.plan ?? "free") as PlanName
  const limits = PLAN_LIMITS[plan as PlanName] ?? PLAN_LIMITS.free
  void limits

  const canManage = canManageBilling(membership.role)

  // Fetch UsageCounter for current period: monthly for social_messages/contacts, daily for webhook_events
  const monthlyPeriod = periodKey()
  const dailyPeriod = periodKeyFor("webhook_events")

  const countersRaw = await db.usageCounter.findMany({
    where: {
      workspaceId: workspace.id,
      OR: [
        { kind: "social_messages", period: monthlyPeriod },
        { kind: "webhook_events", period: dailyPeriod },
        { kind: "contacts", period: monthlyPeriod },
      ],
    },
  })

  const byKind = new Map(countersRaw.map((c) => [`${c.kind}:${c.period}`, c.count] as const))
  const counters = {
    social_messages: byKind.get(`social_messages:${monthlyPeriod}`) ?? 0,
    webhook_events: byKind.get(`webhook_events:${dailyPeriod}`) ?? 0,
    contacts: byKind.get(`contacts:${monthlyPeriod}`) ?? 0,
  }

  // Also fetch total contacts count as fallback context (absolute usage)
  const totalContacts = await db.contact.count({ where: { workspaceId: workspace.id } })

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">Plan, usage, and Stripe billing for {workspace.name}.</p>
      </div>

      <PlanCard
        workspaceId={workspace.id}
        plan={plan}
        status={subscription?.status ?? null}
        canManageBilling={canManage}
        hasSubscription={!!subscription}
      />

      <QuotaBars plan={plan} counters={counters} />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Workspace plan and subscription state.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Plan</span>
            <Badge className="capitalize">{plan}</Badge>
            {subscription?.status ? (
              <Badge variant="outline" className="capitalize">
                {subscription.status}
              </Badge>
            ) : (
              <Badge variant="outline">no subscription</Badge>
            )}
          </div>
          {subscription?.currentPeriodEnd ? (
            <p className="text-muted-foreground">
              Current period ends {formatDate(subscription.currentPeriodEnd)}
            </p>
          ) : null}
          <p className="text-muted-foreground">Total contacts in workspace: {totalContacts.toLocaleString()}</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" render={<Link href={`/${slug}/settings`} />}>
              Back to settings
            </Button>
            <Button variant="link" size="sm" render={<Link href={`/${slug}/settings/members`} />}>
              Manage members
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
