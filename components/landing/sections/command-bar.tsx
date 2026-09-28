import type { ComponentType } from "react"
import { SectionHeader } from "@/components/landing/section-header"
import { Kbd } from "@/components/ui/kbd"
import { Search, ArrowUp, Send, Calendar, Phone, FileText, MessageSquare } from "lucide-react"

/**
 * Command bar.
 *
 * Layout family: a single contained panel on a sunken ground, header left-aligned
 * above it. This is the first break in the page's vertical rhythm after the
 * sticky-rail timeline, so it reads as a different kind of moment.
 *
 * The Cmd-K hint lived in the hero as a banned micro-strip. It belongs here, on
 * the one section that is actually about a keyboard shortcut.
 *
 * The six rows are grouped by what they do (look up / act / produce) instead of
 * being a flat list of six near-identical icon-and-sentence rows.
 *
 * `lg:items-center` is load-bearing: the command panel is 527px tall and the
 * header beside it is a title plus two lines. Top-aligned, that left a ~490x400
 * void that read as a broken layout. Centring the header on the panel's optical
 * middle is what makes the pair look composed rather than half-finished.
 */
const GROUPS: { label: string; items: { text: string; icon: ComponentType<{ className?: string }> }[] }[] = [
  {
    label: "Look up",
    items: [
      { text: "Show me leads not contacted in 2 days.", icon: Search },
      { text: "Which 3BHK buyers are likely to book this week?", icon: Search },
    ],
  },
  {
    label: "Act",
    items: [
      { text: "Call Amit Patel now.", icon: Phone },
      { text: "Schedule a visit for Priya tomorrow.", icon: Calendar },
      { text: "Send the cost sheet to Rahul.", icon: Send },
    ],
  },
  {
    label: "Produce",
    items: [
      { text: "Create a demand letter for A-1204.", icon: FileText },
      { text: "Draft a WhatsApp reply in Gujarati.", icon: MessageSquare },
    ],
  },
]

export function CommandBarSection() {
  return (
    <section className="border-y border-border/70 bg-surface-sunken">
      <div className="mx-auto max-w-[1280px] px-6 py-20 lg:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16">
          <SectionHeader
            title="Ask in plain English."
            body="Estate360 finds the lead, drafts the message, books the visit or pulls the demand letter. No drilling through menus to find the button that does it."
          />

          <div className="rounded-md border border-border/70 bg-card p-5 shadow-e2">
            <div className="flex items-center gap-2 border-b border-border/60 pb-4">
              <Kbd className="text-[10px]">⌘</Kbd>
              <Kbd className="text-[10px]">K</Kbd>
              <span className="ml-1 text-[12px] text-muted-foreground">
                from anywhere, including mid-WhatsApp reply
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2.5 rounded-sm border border-border bg-surface-sunken px-3 py-2.5">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="min-w-0 flex-1 truncate text-[14px] text-foreground">
                Which of my deals are stuck?
              </p>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-brand text-brand-foreground">
                <ArrowUp className="size-3.5" aria-hidden />
              </span>
            </div>

            <div className="mt-5 space-y-5">
              {GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {group.label}
                  </p>
                  <ul className="mt-2 rule-y">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      return (
                        <li
                          key={item.text}
                          className="flex items-center gap-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Icon className="size-3.5 shrink-0" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{item.text}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
