"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, CheckCheck, Send, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { sendWhatsAppMessage } from "@/modules/whatsapp/actions"

export type TimelineItem = {
  id: string
  body?: string | null
  channel?: string | null
  direction?: string | null
  source?: string | null
  type?: string
  /** Outbound delivery state from Meta's statuses webhook. */
  status?: string | null
  /** True when the row carries a provider message id and can receive receipts. */
  tracked?: boolean
  createdAt: Date | string
}

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  EMAIL: "Email",
  LEAD: "Lead",
  CALL: "Call",
  WEB: "Website",
  NOTE: "Note",
  AUDIT: "Audit",
  SOCIAL: "Social",
}

function when(value: Date | string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
}

/** WhatsApp's tick states. `mock` is explicit so dev sends never look delivered. */
function DeliveryMark({ status }: { status?: string | null }) {
  if (!status) return null
  if (status === "mock") {
    return <span className="ml-1 rounded bg-amber-500/20 px-1 text-[9px] font-medium">not sent (mock)</span>
  }
  if (status === "failed") return <span className="ml-1 text-[10px] text-red-300">✕ failed</span>
  if (status === "sent") return <Check className="ml-1 inline size-3 opacity-70" />
  if (status === "delivered") return <CheckCheck className="ml-1 inline size-3 opacity-70" />
  if (status === "read") return <CheckCheck className="ml-1 inline size-3 text-sky-300" />
  return null
}

export default function InboxTimeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No messages yet. Inbound WhatsApp messages land here automatically once the account is linked.
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 p-4">
      {items.map((it) => {
        const out = it.direction === "OUT"
        const channelLabel = CHANNEL_LABEL[it.channel ?? ""] ?? it.channel ?? "Note"
        return (
          <div key={it.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                out ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              <div className="whitespace-pre-wrap">{it.body || <span className="italic opacity-60">(no text)</span>}</div>
              <div className="mt-1 flex items-center text-[10px] opacity-70">
                {channelLabel} · {when(it.createdAt)}
                {out ? <DeliveryMark status={it.status} /> : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export type ReplyContext = {
  hasPhone: boolean
  optedOut: boolean
  connected: boolean
  connectedNumber: string | null
  lastInboundAt: Date | null
  windowRemainingMs: number | null
  windowOpen: boolean
}

function humaniseRemaining(ms: number | null): string | null {
  if (ms === null) return null
  if (ms <= 0) return "closed"
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  if (hours >= 24) return "open"
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`
}

/**
 * Composer.
 *
 * WhatsApp only allows free-form text inside the 24-hour customer-service window
 * opened by the contact's last inbound message. That gate is evaluated on the
 * server too — this UI just explains it instead of sending a message Meta will
 * reject and the agent will assume went through.
 */
export function InboxComposer({
  workspaceId,
  contactId,
  context,
  channel,
}: {
  workspaceId: string
  contactId: string
  context: ReplyContext
  channel: string
}) {
  const router = useRouter()
  const [body, setBody] = useState("")
  const [pending, startTransition] = useTransition()

  const blockers: string[] = []
  if (channel !== "WHATSAPP") blockers.push(`This thread started on ${CHANNEL_LABEL[channel] ?? channel} — replies here are WhatsApp only.`)
  if (!context.hasPhone) blockers.push("This contact has no phone number.")
  if (context.optedOut) blockers.push("This contact opted out of messaging.")
  if (!context.connected) blockers.push("WhatsApp is not linked for this workspace yet.")
  if (context.connected && !context.windowOpen) {
    blockers.push(
      context.lastInboundAt
        ? "The 24-hour reply window has closed. The contact must message in first (or use an approved template)."
        : "This contact has never messaged in, so free-form WhatsApp is not allowed yet.",
    )
  }

  const blocked = blockers.length > 0
  const remaining = humaniseRemaining(context.windowRemainingMs)

  function handleSend() {
    const trimmed = body.trim()
    if (!trimmed || blocked) return
    startTransition(async () => {
      const res = await sendWhatsAppMessage({ workspaceId, contactId, body: trimmed })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.mock ? "Logged locally — WhatsApp not live (mock send)." : "Sent on WhatsApp.")
      setBody("")
      router.refresh()
    })
  }

  return (
    <div className="border-t bg-card/80 p-3">
      {blocked ? (
        <p className="mb-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
          <span>{blockers[0]}</span>
        </p>
      ) : (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Reply window: {remaining ?? "open"}
          {context.connectedNumber ? ` · via ${context.connectedNumber}` : ""}
        </p>
      )}

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={blocked ? "Cannot reply on this thread" : "Reply…"}
        className="min-h-[60px] resize-none text-sm"
        disabled={blocked || pending}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSend()
        }}
      />

      <div className="mt-2 flex items-center justify-end gap-2">
        {context.optedOut ? <span className="text-[11px] font-medium text-destructive">Contact opted out</span> : null}
        <Button size="sm" onClick={handleSend} disabled={blocked || pending || !body.trim()} className="gap-1">
          <Send className="size-3.5" />
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  )
}
