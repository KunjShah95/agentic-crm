import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { listInboxContacts, getContactTimeline } from "@/modules/whatsapp/queries"
import InboxTimeline from "@/components/inbox/InboxTimeline"
import Link from "next/link"

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>
  searchParams: Promise<{ c?: string }>
}) {
  const { workspace: slug } = await params
  const { c: selectedId } = await searchParams
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) notFound()

  const contacts = await listInboxContacts(ws.id)
  const active = selectedId ?? contacts[0]?.id
  const timeline = active ? await getContactTimeline(ws.id, active) : []

  return (
    <div className="flex h-[calc(100vh-4rem)] rounded-[16px] border bg-card overflow-hidden">
      <aside className="w-72 border-r bg-muted/20 overflow-y-auto">
        <div className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Inbox</h2><span className="rounded-full bg-foreground px-2 py-0.5 font-mono text-[11px] text-background">{contacts.length}</span>
        </div>
        {contacts.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No leads yet.</p>
        ) : (
          contacts.map((c) => (
            <Link
              key={c.id}
              href={`/${slug}/inbox?c=${c.id}`}
              className={`block px-4 py-3 border-b hover:bg-muted/50 transition-colors ${c.id === active ? "bg-muted border-l-2 border-l-violet-600" : "border-l-2 border-l-transparent"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {c.firstName} {c.lastName}
                </span>
                {typeof c.leadScore === "number" ? (
                  <span className={`text-xs rounded-full px-2 py-0.5 font-mono ${c.leadScore != null && c.leadScore >= 70 ? "bg-emerald-500 text-white" : c.leadScore != null && c.leadScore >= 40 ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    {c.leadScore}
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {c.leadSource ?? "—"} · {c.phone ?? "no phone"}
              </div>
            </Link>
          ))
        )}
      </aside>
      <section className="flex-1 overflow-y-auto">
        <InboxTimeline items={timeline} />
      </section>
    </div>
  )
}
