import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  listInboxContacts,
  listInboxContactsByChannel,
  getContactTimeline,
  toTimelineItems,
  getReplyContext,
} from "@/modules/whatsapp/queries"
import InboxTimeline, { InboxComposer } from "@/components/inbox/InboxTimeline"
import Link from "next/link"
import { MessageSquareQuote, Phone, Mail, Globe, Lightbulb, MessagesSquare } from "lucide-react"

export const dynamic = "force-dynamic"

const CHANNELS = [
  { id: "all", label: "All", icon: MessageSquareQuote },
  { id: "WHATSAPP", label: "WhatsApp", icon: MessagesSquare },
  { id: "CALL", label: "Calls", icon: Phone },
  { id: "EMAIL", label: "Email", icon: Mail },
  { id: "WEB", label: "Web", icon: Globe },
  { id: "LEAD", label: "Leads", icon: Lightbulb },
] as const

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>
  searchParams: Promise<{ c?: string; channel?: string }>
}) {
  const { workspace: slug } = await params
  const { c: selectedId, channel: filterChannel } = await searchParams

  // TENANT BOUNDARY. This page used to resolve the workspace straight from the
  // URL slug and query it with no session check, so any logged-in user of any
  // tenant could open /<other-slug>/inbox and read that tenant's contacts,
  // phone numbers and full message history. The (app) layout only proves a
  // session exists — it does not prove membership in *this* workspace.
  const session = await auth()
  if (!session?.user?.id) notFound()

  const workspace = await db.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true },
  })
  if (!workspace) notFound()

  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: session.user.id } },
  })
  if (!membership) notFound()

  const useFilter = Boolean(filterChannel && filterChannel !== "all")
  const contacts = useFilter
    ? await listInboxContactsByChannel(workspace.id, filterChannel!)
    : await listInboxContacts(workspace.id)

  // Only honour a selected id that actually belongs to this workspace.
  const selected = selectedId && contacts.some((c) => c.id === selectedId) ? selectedId : contacts[0]?.id
  const rawTimeline = selected ? await getContactTimeline(workspace.id, selected) : []
  const timeline = toTimelineItems(rawTimeline)

  const replyContext = selected
    ? await getReplyContext({ workspaceId: workspace.id, contactId: selected })
    : null

  const needsReplyCount = contacts.filter((c) => c.needsReply).length

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-[16px] border bg-card md:h-[calc(100vh-4rem)] md:flex-row">
      <aside
        className={`w-full shrink-0 overflow-y-auto border-b bg-muted/20 md:block md:w-80 md:border-r md:border-b-0 ${
          selectedId ? "hidden" : "block"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/80 px-4 py-3 backdrop-blur">
          <h2 className="text-sm font-semibold">Inbox</h2>
          <div className="flex items-center gap-2">
            {needsReplyCount > 0 ? (
              <span className="rounded-full bg-brand px-2 py-0.5 font-mono text-[11px] text-background">
                {needsReplyCount} to reply
              </span>
            ) : null}
            <span className="rounded-full border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {contacts.length}
            </span>
          </div>
        </div>

        <div className="hidden border-b bg-card/50 px-4 py-2 md:block">
          <div className="flex gap-1 overflow-x-auto">
            {CHANNELS.map((ch) => {
              const Icon = ch.icon
              const isActive = (filterChannel ?? "all") === ch.id
              return (
                <Link
                  key={ch.id}
                  href={`/${slug}/inbox?channel=${ch.id}`}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon className="size-3" />
                  {ch.label}
                </Link>
              )
            })}
          </div>
        </div>

        {contacts.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            <p>No conversations yet.</p>
            <p className="mt-2 text-xs">
              WhatsApp messages from linked contacts appear here automatically.
            </p>
          </div>
        ) : (
          contacts.map((c) => (
            <Link
              key={c.id}
              href={`/${slug}/inbox?c=${c.id}`}
              className={`block border-b px-4 py-3 transition-colors hover:bg-muted/50 ${
                c.id === selected ? "border-l-2 border-l-brand bg-muted" : "border-l-2 border-l-transparent"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {c.firstName} {c.lastName}
                </span>
                {c.needsReply ? <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-label="Needs reply" /> : null}
                {typeof c.leadScore === "number" ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-xs ${
                      c.leadScore >= 70
                        ? "bg-emerald-500 text-white"
                        : c.leadScore >= 40
                          ? "bg-amber-500 text-white"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.leadScore}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {c.last.body?.trim() || `${c.leadSource ?? "—"} · ${c.phone ?? "no phone"}`}
              </p>
              {c.last.at ? (
                <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                  {new Date(c.last.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              ) : null}
            </Link>
          ))
        )}
      </aside>

      <section className={`min-h-0 flex-1 overflow-y-auto ${selectedId ? "block" : "hidden md:block"}`}>
        {selectedId ? (
          <div className="sticky top-0 z-10 border-b bg-card/80 px-4 py-2 backdrop-blur md:hidden">
            <Link
              href={`/${slug}/inbox?channel=${filterChannel ?? "all"}`}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              ← Back to conversations
            </Link>
          </div>
        ) : null}

        <InboxTimeline items={timeline} />

        {selected && replyContext ? (
          <InboxComposer
            workspaceId={workspace.id}
            contactId={selected}
            context={replyContext}
            channel={
              // Reply on the channel of the NEWEST message, not the first-ever one.
              timeline[timeline.length - 1]?.channel ?? "WHATSAPP"
            }
          />
        ) : null}
      </section>
    </div>
  )
}
