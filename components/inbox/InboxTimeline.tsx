"use client"

export type TimelineItem = {
  id: string
  body?: string | null
  channel?: string | null
  direction?: string | null
  createdAt: Date | string
}

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  EMAIL: "Email",
  LEAD: "Lead",
  CALL: "Call",
}

export default function InboxTimeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) {
    return <div className="text-sm text-muted-foreground p-4">No messages yet.</div>
  }
  return (
    <div className="flex flex-col gap-2 p-4">
      {items.map((it) => {
        const out = it.direction === "OUT"
        return (
          <div key={it.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                out ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              <div className="whitespace-pre-wrap">{it.body}</div>
              <div className="mt-1 text-[10px] opacity-70">
                {CHANNEL_LABEL[it.channel ?? ""] ?? it.channel ?? "Note"} ·{" "}
                {new Date(it.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
