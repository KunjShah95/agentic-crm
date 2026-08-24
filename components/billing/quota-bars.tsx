import { PLAN_LIMITS, type PlanName } from "@/modules/billing/limits"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export type QuotaCounters = {
  social_messages: number
  webhook_events: number
  contacts: number
}

type QuotaBarsProps = {
  plan: PlanName
  counters: QuotaCounters
}

function pct(used: number, limit: number) {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

function Bar({
  label,
  used,
  limit,
  periodLabel,
}: {
  label: string
  used: number
  limit: number
  periodLabel: string
}) {
  const value = pct(used, limit)
  const over = used >= limit
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={over ? "destructive" : "secondary"} className="tabular-nums">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </Badge>
      </div>
      <Progress value={value} aria-label={`${label} usage`} />
      <p className="text-xs text-muted-foreground">
        {value}% used · {periodLabel}
        {over ? " · limit reached" : ""}
      </p>
    </div>
  )
}

export function QuotaBars({ plan, counters }: QuotaBarsProps) {
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
        <CardDescription>
          Current period usage vs plan limits. Plan: <span className="capitalize font-medium text-foreground">{plan}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Bar
          label="Social messages"
          used={counters.social_messages}
          limit={limits.msgPerMonth}
          periodLabel="per month"
        />
        <Bar
          label="Webhook events"
          used={counters.webhook_events}
          limit={limits.webhookPerDay}
          periodLabel="per day"
        />
        <Bar
          label="Contacts"
          used={counters.contacts}
          limit={limits.maxContacts}
          periodLabel="per month (metered)"
        />
        <div className="flex flex-wrap gap-2 border-t pt-4 text-xs text-muted-foreground">
          <span>Seats: {limits.maxSeats}</span>
          <span>·</span>
          <span>Social accounts: {limits.maxSocialAccounts}</span>
          <span>·</span>
          <span>Agent credits: {limits.agentCreditsPerMo.toLocaleString()}/mo</span>
        </div>
      </CardContent>
    </Card>
  )
}
