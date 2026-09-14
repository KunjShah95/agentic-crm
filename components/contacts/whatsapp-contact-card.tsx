"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MessageSquare, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { sendWhatsAppMessage } from "@/modules/whatsapp/actions"

/**
 * WhatsApp thread shortcut on the contact page.
 *
 * WhatsApp only: X and LinkedIn were removed, so this no longer renders a card
 * per provider. It appears when the contact has a WhatsApp handle (or a phone
 * number) and the workspace has an active connection.
 */

type WhatsAppConnection = {
  id: string
  status: string
  externalAccountId: string
  displayName: string | null
}

type ContactRef = {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  handles: unknown
}

export function WhatsAppContactCard({
  workspaceId,
  contact,
  connection,
}: {
  workspaceId: string
  contact: ContactRef
  connection: WhatsAppConnection | null
}) {
  const router = useRouter()
  const handles = (contact.handles as Record<string, string> | null) ?? {}
  const number = handles.whatsapp ?? contact.phone
  const [body, setBody] = useState("")
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)

  if (!connection || !number) return null

  const active = connection.status === "active"

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSending(true)
    try {
      const res = await sendWhatsAppMessage({ workspaceId, contactId: contact.id, body: trimmed })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      // A mock send is reported as such — it never reads as delivered.
      toast.success(res.mock ? "Logged locally — WhatsApp is not live yet (mock send)." : "Message sent on WhatsApp.")
      setBody("")
      setOpen(false)
      router.refresh()
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="size-4 text-green-600" />
          WhatsApp
          <span
            className={
              "rounded-full px-2 py-0.5 text-[10px] font-medium " +
              (active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")
            }
          >
            {active ? "Connected" : "Needs reconnect"}
          </span>
        </CardTitle>
        <CardDescription>
          {connection.displayName ?? connection.externalAccountId} · {number}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {open ? (
          <div className="flex gap-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`Message ${contact.firstName}…`}
              className="min-h-[64px] resize-none text-sm"
              autoFocus
              disabled={sending}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSend()
              }}
            />
            <div className="flex flex-col gap-1">
              <Button size="sm" className="gap-1" onClick={handleSend} disabled={!body.trim() || sending}>
                <Send className="size-3.5" />
                {sending ? "Sending…" : "Send"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={sending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)} disabled={!active}>
            <Send className="mr-1 size-3.5" />
            Message on WhatsApp
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
