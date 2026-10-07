import Link from "next/link"
import { Plus } from "lucide-react"
import { SectionHeader } from "@/components/landing/section-header"
import { FAQ } from "@/content/marketing"

/**
 * Objections, answered at the point of decision.
 *
 * Sits directly under pricing because that is where a visitor stops to ask
 * "what is the catch". The home page already ships every FAQ entry as
 * `FAQPage` structured data via `graphLd()`, but rendered none of them, which
 * is exactly the structured-data-only FAQ the pricing page warns against.
 *
 * Six of the ten, chosen for the questions that block a trial rather than the
 * ones that explain the product (the sections above already do that). Native
 * `<details>` so it works without JavaScript and with the keyboard.
 */
const PICKED = [
  "Is there a free trial?",
  "How long does setup take?",
  "What happens to my data if I leave?",
  "Can a broker see our whole inventory?",
  "Does it handle RERA documentation?",
  "Which languages does the WhatsApp inbox support?",
]

const ITEMS = PICKED.map((q) => FAQ.find((f) => f.q === q)).filter(
  (f): f is (typeof FAQ)[number] => Boolean(f)
)

export function FaqSection() {
  return (
    <section id="faq" className="border-t border-border/70 bg-background">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-8 lg:py-28">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeader
            title="Six questions before you start."
            body="The ones builders ask on the first call. Anything else, write to us and a person replies the same working day."
          />
          <Link
            href="/contact"
            className="mt-6 inline-flex text-[14px] font-medium underline underline-offset-4 hover:text-brand-solid"
          >
            Ask something else
          </Link>
        </div>

        <div className="rule-y border-y border-border/70">
          {ITEMS.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] font-semibold tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                {f.q}
                <Plus
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                  aria-hidden
                />
              </summary>
              <p className="max-w-[62ch] pb-5 text-[14px] leading-7 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
