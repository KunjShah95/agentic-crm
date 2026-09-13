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
    <div className="flex h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-[16px] border bg-card md:h-[calc(100vh-4rem)] md:flex-row">
      <aside
        className={`w-full shrink-0 overflow-y-auto border-b bg-muted/20 md:block md:w-72 md:border-r md:border-b-0 ${
          selectedId ? "hidden" : "block"
        }`}
      >
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
              className={`block px-4 py-3 border-b hover:bg-muted/50 transition-colors ${c.id === active ? "bg-muted border-l-2 border-l-brand" : "border-l-2 border-l-transparent"}`}
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
      <section className={`min-h-0 flex-1 overflow-y-auto ${selectedId ? "block" : "hidden md:block"}`}>
        {selectedId ? (
          <div className="sticky top-0 z-10 border-b bg-card/80 px-4 py-2 backdrop-blur md:hidden">
            <Link
              href={`/${slug}/inbox`}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              ← Back to conversations
            </Link>
          </div>
        ) : null}
        <InboxTimeline items={timeline} />
      </section>
    </div>
  )
}
