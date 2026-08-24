"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { PlanName } from "@/modules/billing/limits"

type PlanCardProps = {
  workspaceId: string
  plan: PlanName
  status: string | null
  canManageBilling: boolean
  hasSubscription: boolean
}

export function PlanCard({ workspaceId, plan, status, canManageBilling, hasSubscription }: PlanCardProps) {
  const [loading, setLoading] = useState<"portal" | "checkout" | null>(null)
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
      if (data.url) window.location.href = data.url
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  async function handleCheckout(targetPlan: PlanName) {
    setError(null)
    setLoading("checkout")
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, plan: targetPlan }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to start checkout")
      if (data.url) window.location.href = data.url
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Current plan
          <Badge className="capitalize">{plan}</Badge>
          {status ? (
            <Badge variant="secondary" className="capitalize">
              {status}
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          {hasSubscription ? "Managed by Stripe." : "No active Stripe subscription — using workspace plan."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {canManageBilling ? (
          <div className="flex flex-wrap gap-2">
            {hasSubscription ? (
              <Button onClick={handlePortal} disabled={loading !== null}>
                {loading === "portal" ? "Opening…" : "Manage billing"}
              </Button>
            ) : null}
            {plan !== "pro" ? (
              <Button
                variant={hasSubscription ? "outline" : "default"}
                onClick={() => handleCheckout("pro")}
                disabled={loading !== null}
              >
                {loading === "checkout" ? "Redirecting…" : "Upgrade to Pro"}
              </Button>
            ) : null}
            {plan !== "scale" ? (
              <Button variant="outline" onClick={() => handleCheckout("scale")} disabled={loading !== null}>
                Upgrade to Scale
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Only owners and admins can manage billing.</p>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!canManageBilling && !hasSubscription ? (
          <p className="text-xs text-muted-foreground">Contact your workspace owner to change the plan.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
