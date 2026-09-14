import type { ReactNode } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

/**
 * "A day in Estate360" — master prompt #30.
 *
 * Replaces the feature catalogue with a time-stamped story of the product
 * doing work for a sales rep. Each beat shows Estate360 surfacing something
 * the user otherwise would have to discover manually.
 *
 * Language follows #32: no "AI-powered", just observable outcomes and verbs.
 */
type Beat = {
    time: string
  label: string
  title: ReactNode
  detail: string
  cta?: { label: string; href: string }
}

const BEATS: Beat[] = [
  {
    time: "9:02 AM",
    label: "New enquiries",
    title: "12 new enquiries arrived.",
    detail: "Estate360 sorted them for you — 4 hot, 5 warm, 3 to nurture. The hot leads visited a site yesterday.",
    cta: { label: "See hot leads", href: "#story" },
  },
  {
    time: "9:17 AM",
    label: "Property match",
    title: "Buyer: “3BHK under ₹90L near SG Highway?”",
    detail: "Estate360 found 3 matching units in Shaligram Lakeview. Cost sheets already pre-filled.",
    cta: { label: "Send these options", href: "#story" },
  },
  {
    time: "10:03 AM",
    label: "Site visit done",
    title: "Rahul Shah completed his visit.",
    detail: "He opened the cost sheet twice and asked about the payment plan. Estate360 flagged: follow up within 2 hours.",
    cta: { label: "WhatsApp Rahul", href: "#story" },
  },
  {
    time: "11:20 AM",
    label: "Cost sheet",
    title: "A-1204 cost sheet generated.",
    detail: "₹82,00,000 — base + GST + stamp duty + other charges. Ready to send.",
    cta: { label: "Send to buyer", href: "#story" },
  },
  {
    time: "2:40 PM",
    label: "Booking confirmed",
    title: "Rahul Shah booked A-1204.",
    detail: "8 CLP milestones created, demand letter #1 queued, activity logged. KYC checklist assigned to you.",
    cta: { label: "View booking journey", href: "#story" },
  },
]

export function StorySection() {
  return (
    <section id="story" className="border-y bg-background">
      <div className="mx-auto max-w-[1100px] px-6 py-14 lg:px-8 lg:py-20">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/70">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden /> A day in Estate360
          </span>
          <h2 className="mt-3 font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[36px]">
            One morning, one story.
          </h2>
          <p className="mx-auto mt-3 max-w-[560px] text-[14px] leading-6 text-muted-foreground">
            Instead of hunting across WhatsApp, Excel, and email, your day runs through a single screen that surfaces what matters — now.
          </p>
        </div>

        <div className="mt-12 space-y-12">
          {BEATS.map((b) => (
            <BeatItem key={b.time} beat={b} />
          ))}
        </div>
      </div>
    </section>
  )
}

function BeatItem({ beat }: { beat: Beat }) {
  return (
    <div className="relative pl-[70px]">
      <span aria-hidden className="pointer-events-none absolute left-[26px] top-0 bottom-4 w-px bg-border" />
      <div className="absolute left-[14px] top-0 flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted/50 font-mono text-[10px] font-medium text-muted-foreground">
        {beat.time}
      </div>
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/60">
          <span className="size-1.5 rounded-full bg-brand" aria-hidden /> {beat.label}
        </div>
        <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em]">{beat.title}</h3>
        <p className="max-w-[520px] text-[14px] leading-6 text-muted-foreground">{beat.detail}</p>
        {beat.cta ? <Button size="sm" className="mt-2 h-8 gap-1 rounded-full text-[12px]" render={<Link href={beat.cta!.href} />}>{beat.cta.label}</Button> : null}
      </div>
    </div>
  )
}
