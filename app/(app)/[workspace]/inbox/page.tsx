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
    <div className="flex h-[calc(100vh-4rem)]">
      <aside className="w-72 border-r overflow-y-auto">
        <h2 className="px-4 py-3 text-sm font-semibold border-b">Inbox</h2>
        {contacts.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No leads yet.</p>
        ) : (
          contacts.map((c) => (
            <Link
              key={c.id}
              href={`/${slug}/inbox?c=${c.id}`}
              className={`block px-4 py-3 border-b hover:bg-muted ${c.id === active ? "bg-muted" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {c.firstName} {c.lastName}
                </span>
                {typeof c.leadScore === "number" ? (
                  <span className="text-xs rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5">
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
