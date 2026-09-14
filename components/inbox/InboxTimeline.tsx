"use client"

import { sendSocialMessage } from "@/lib/actions/social-send"
import { sendWhatsAppMessage } from "@/modules/whatsapp/actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { Send } from "lucide-react"
export type TimelineItem = {
  id: string
  body?: string | null
  channel?: string | null
  direction?: string | null
  source?: string | null
  type?: string | null
  createdAt: Date | string
  socialProvider?: string | null
}

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  EMAIL: "Email",
  LEAD: "Lead",
  CALL: "Call",
  WEB: "Website",
  X: "X (DM)",
  LINKEDIN: "LinkedIn",
  SOCIAL: "Social",
  NOTE: "Note",
}

export default function InboxTimeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) {
    return <div className="text-sm text-muted-foreground p-4">No messages yet.</div>
  }
  return (
    <div className="flex flex-col gap-2 p-4">
      {items.map((it) => {
        const out = it.direction === "OUT"
        const channelLabel =
          it.socialProvider
            ? CHANNEL_LABEL[it.socialProvider.toUpperCase()] ?? it.socialProvider
            : CHANNEL_LABEL[it.channel ?? ""] ?? it.channel ?? "Note"
        return (
          <div key={it.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                out ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              <div className="whitespace-pre-wrap">{it.body}</div>
              <div className="mt-1 text-[10px] opacity-70">
                {channelLabel} ·{" "}
                {new Date(it.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Reply bar for the inbox — sends via the appropriate channel.
 * For WhatsApp uses the WhatsApp adapter; for social providers uses sendSocialMessage.
 */
export function InboxReplyBar({
  workspaceId,
  contactId,
  channel,
  socialProvider,
  onSent,
}: {
  workspaceId: string
  contactId: string
  channel?: string | null
  socialProvider?: string | null
  onSent?: () => void
}) {
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSending(true)
    try {
      if (channel === "WHATSAPP" || socialProvider === "whatsapp") {
        await sendWhatsAppMessage({ workspaceId, contactId, body: trimmed })
      } else if (socialProvider === "x" || channel === "X") {
        await sendSocialMessage({ workspaceId, contactId, provider: "x", body: trimmed })
      } else if (socialProvider === "linkedin" || channel === "LINKEDIN") {
        await sendSocialMessage({ workspaceId, contactId, provider: "linkedin", body: trimmed })
      } else {
        // Fallback: log as manual note
        await sendSocialMessage({ workspaceId, contactId, provider: "whatsapp", body: trimmed })
      }
      setBody("")
      onSent?.()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border-t bg-card/80 p-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Reply…"
        className="min-h-[60px] resize-none text-sm"
        disabled={sending}
      />
      <div className="flex justify-end gap-2 mt-2">
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!body.trim() || sending}
          className="gap-1"
        >
          <Send className="size-3.5" />
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  )
}
