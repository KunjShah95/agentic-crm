"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Bot, CalendarPlus, LoaderCircle, Phone, MessageCircle, MapPin, BellRing, CheckCircle } from "lucide-react"

import { createFollowUps, getNextBestActions } from "@/modules/ai/actions"
import type { SuggestedAction } from "@/modules/ai/suggest"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const ACTION_ICON: Record<SuggestedAction["action"], React.ReactNode> = {
  CALL: <Phone className="size-3.5" />,
  WHATSAPP: <MessageCircle className="size-3.5" />,
  SITE_VISIT: <MapPin className="size-3.5" />,
  NUDGE: <BellRing className="size-3.5" />,
  CLOSE: <CheckCircle className="size-3.5" />,
}

/**
 * AI next-best-actions for a contact — the workflow surface for the
 * suggest/scheduler engine. Loads the ranked top-3 on mount (read-only,
 * workspace-scoped via the server action's session gate) and offers a
 * one-click "schedule follow-ups" that writes the score-band cadence.
 */
export function NextBestActionsCard({
  workspaceId,
  contactId,
}: {
  workspaceId: string
  contactId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [scheduling, setScheduling] = React.useState(false)
  const [actions, setActions] = React.useState<SuggestedAction[]>([])
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let active = true
    void (async () => {
      try {
        const rows = await getNextBestActions(workspaceId, contactId)
        if (active) setActions(rows)
      } catch {
        if (active) setFailed(true)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [workspaceId, contactId])

  async function onSchedule() {
    setScheduling(true)
    try {
      await createFollowUps(workspaceId, contactId)
      toast.success("Follow-ups scheduled on the timeline.")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not schedule follow-ups.")
    } finally {
      setScheduling(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="size-4 text-brand" /> Next best actions
        </CardTitle>
        <CardDescription>AI-ranked from score, stage and idle time. Nothing sends without you.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <LoaderCircle className="size-3.5 animate-spin" /> Ranking actions…
          </p>
        ) : failed ? (
          <p className="text-sm text-muted-foreground">Could not rank actions right now.</p>
        ) : (
          actions.map((a) => (
            <div key={a.action} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-muted-foreground">{ACTION_ICON[a.action]}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{a.action.replace("_", " ")}</div>
                  <div className="truncate text-xs text-muted-foreground">{a.reason}</div>
                </div>
              </div>
              <Badge variant="secondary" className="tabular-nums shrink-0">{a.priority}</Badge>
            </div>
          ))
        )}
        <Button size="sm" variant="outline" onClick={onSchedule} disabled={scheduling || loading}>
          {scheduling ? <LoaderCircle className="size-3.5 animate-spin" /> : <CalendarPlus className="size-3.5" />}
          Schedule follow-ups
        </Button>
      </CardContent>
    </Card>
  )
}
