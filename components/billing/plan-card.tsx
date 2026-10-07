"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PLAN_LABELS, PLAN_LIMITS, PLAN_PRICES, type PlanName } from "@/modules/billing/limits"

type PlanCardProps = {
  workspaceId: string
  plan: PlanName
  status: string | null
  canManageBilling: boolean
  hasSubscription: boolean
  /** Whole days left while the no-card trial runs; null once paid or lapsed. */
  trialDaysLeft: number | null
  trialExpired: boolean
}

const PAID_PLANS = ["builder", "pro", "scale"] as const

export function PlanCard({
  workspaceId,
  plan,
  status,
  canManageBilling,
  hasSubscription,
  trialDaysLeft,
  trialExpired,
}: PlanCardProps) {
  const [loading, setLoading] = useState<"portal" | PlanName | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePortal() {
    setError(null)
    setLoading("portal")
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to open billing portal")
      if (data.url) window.location.assign(data.url)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  async function handleCheckout(targetPlan: PlanName) {
    setError(null)
    setLoading(targetPlan)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, plan: targetPlan }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to start checkout")
      if (data.url) window.location.assign(data.url)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Current plan
          <Badge>{trialDaysLeft !== null ? `${PLAN_LABELS[plan]} trial` : PLAN_LABELS[plan]}</Badge>
          {status ? (
            <Badge variant="secondary" className="capitalize">
              {status.replace("_", " ")}
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          {hasSubscription
            ? "Billed monthly. Change plan, card or invoices in the billing portal."
            : trialDaysLeft !== null
              ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left of full Team access. No card needed. Pick a plan any time to keep these limits.`
              : trialExpired
                ? "Your trial has ended and the workspace is on Free limits. Nothing was deleted; pick a plan to restore seats and contacts."
                : "Free plan."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {canManageBilling ? (
          <>
            {hasSubscription ? (
              <div>
                <Button onClick={handlePortal} disabled={loading !== null}>
                  {loading === "portal" ? "Opening…" : "Manage billing"}
                </Button>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3">
                {PAID_PLANS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleCheckout(p)}
                    disabled={loading !== null}
                    className="flex flex-col items-start gap-0.5 rounded-md border p-3 text-left transition-colors hover:border-foreground/30 hover:bg-muted/50 disabled:opacity-60"
                  >
                    <span className="text-[13px] font-semibold">{PLAN_LABELS[p]}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{PLAN_PRICES[p]}</span>
                    <span className="text-xs text-muted-foreground">
                      {loading === p ? "Redirecting…" : `${PLAN_LIMITS[p].maxSeats} seats`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Only owners and admins can manage billing.</p>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
