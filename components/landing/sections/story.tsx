import type { ReactNode } from "react"
import { SectionHeader } from "@/components/landing/section-header"

/**
 * "A day in Estate360".
 *
 * Layout family: sticky left rail + right timeline. Deliberately NOT a second
 * centered stack — the previous version repeated the hero's centred rhythm and
 * gave the page no beat change between sections.
 *
 * The five per-beat CTA buttons are gone. Every one of them linked to #story,
 * i.e. the section you were already in, and five stacked pill buttons were both
 * visual noise and five instances of the same "do the thing" intent.
 */
type Beat = {
  time: string
  title: ReactNode
  detail: string
}

const BEATS: Beat[] = [
  {
    time: "9:02",
    title: "12 new enquiries, already sorted.",
    detail: "Four hot, five warm, three to nurture. The hot ones visited a site yesterday.",
  },
  {
    time: "9:17",
    title: "Buyer asked for 3BHK under ₹90L near SG Highway.",
    detail: "Three matching units in Shaligram Lakeview, cost sheets pre-filled and ready to send.",
  },
  {
    time: "10:03",
    title: "Rahul Shah finished his site visit.",
    detail: "Opened the cost sheet twice, asked about the payment plan. Flagged: follow up within two hours.",
  },
  {
    time: "11:20",
    title: "A-1204 cost sheet generated.",
    detail: "₹82,00,000 — base, GST, stamp duty and other charges, totalled from the unit record.",
  },
  {
    time: "14:40",
    title: "Rahul Shah booked A-1204.",
    detail: "Eight CLP milestones created, demand letter #1 queued, activity logged, KYC checklist assigned.",
  },
]

export function StorySection() {
  return (
    <section id="story" className="border-y border-border/70 bg-background">
      <div className="mx-auto max-w-[1280px] px-6 py-20 lg:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          {/* Sticky rail: the section's argument stays visible while the
              timeline scrolls past it. This is the hierarchy fix — the claim
              no longer scrolls away equal to the detail. */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeader
              title="One morning, one thread."
              body="Instead of hunting across WhatsApp, Excel and email, the day runs through a single screen that decides what happens next."
            />
          </div>

          <ol className="relative">
            {/* The spine. Sits behind the time markers. */}
            <span
              aria-hidden
              className="absolute left-[52px] top-2 bottom-2 w-px bg-border sm:left-[60px]"
            />
            {BEATS.map((beat) => (
              <li key={beat.time} className="relative flex gap-5 pb-10 last:pb-0 sm:gap-6">
                {/*
                  A wall-clock time in a day-in-the-life timeline. Not money and
                  not an identifier, so it takes the sans face with tabular
                  numerals — mono here reads as machine output, which is the
                  wrong connotation for "9:02 AM, a person picked up".
                */}
                <span className="w-[42px] shrink-0 pt-0.5 text-right text-[12px] tabular-nums text-muted-foreground sm:w-[50px]">
                  {beat.time}
                </span>
                <span
                  aria-hidden
                  className="absolute left-[48px] top-1.5 size-2.5 rounded-full border-2 border-background bg-brand sm:left-[56px]"
                />
                <div className="min-w-0 pl-6 sm:pl-8">
                  <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.015em] text-balance">
                    {beat.title}
                  </h3>
                  <p className="mt-1.5 max-w-[52ch] text-[14px] leading-6 text-muted-foreground">
                    {beat.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
