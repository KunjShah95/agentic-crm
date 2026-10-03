import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, MapPin, Clock, ReceiptText, ShieldCheck } from "lucide-react"

/**
 * Why we built it — the closer.
 *
 * IMPORTANT: this section previously carried four testimonials attributed to
 * named individuals at named companies ("Hemal Shah, Shilp Infra, Director",
 * "Nirav Doshi, Safal Corp", and so on). Those are not real customers. Shipping
 * invented people as social proof is a reputational and legal risk, so they have
 * been removed rather than restyled.
 *
 * What replaces them carries the same persuasion without fabricating anyone:
 * the concrete operational change the product makes, stated as capability. If
 * you have real quotes, drop them back into PROOF below.
 */
const PROOF = [
  {
    icon: ReceiptText,
    claim: "Cost sheets and demand notices leave the building in minutes.",
    detail: "Computed from the unit record, not retyped from a spreadsheet.",
  },
  {
    icon: ShieldCheck,
    claim: "Site visits verify themselves.",
    detail: "200m GPS check-in, so a visit log can be trusted by Accounts.",
  },
  {
    icon: Clock,
    claim: "Brokers see only their allocation.",
    detail: "The 'who showed that unit' argument stops happening.",
  },
]

export function ManifestoSection({
  isAuthed,
  workspaceSlug,
}: {
  isAuthed: boolean
  workspaceSlug?: string | null
}) {
  const cta = isAuthed && workspaceSlug ? `/${workspaceSlug}/contacts` : "/signup"

  return (
    <section id="manifesto" className="relative isolate overflow-hidden border-t border-border/70">
      <div aria-hidden className="field-gradient -z-10 opacity-70" />

      <div className="mx-auto max-w-[1280px] px-6 py-20 lg:px-8 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <h2 className="font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] text-balance sm:text-[42px]">
              Possession is not luck.
              <br />
              It is a loop that closes.
            </h2>
            <p className="mt-5 max-w-[46ch] text-[15px] leading-7 text-muted-foreground text-pretty">
              We built Estate360 for NAAR-registered builders in Ahmedabad: two
              to ten sites, SG Highway through South Bopal, one workspace shared
              by Owners, Sales, Brokers, Site and Accounts. Gujarati and Hindi
              where the buyer reads it. RERA-correct where the auditor needs it.
            </p>

            <p className="mt-6 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              Currently running across Ahmedabad NAAR associations
            </p>

            <Button variant="brand" className="mt-8 gap-2 px-6" size="lg" render={<Link href={cta} />}>
              Start free
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>

          <ul className="rule-y self-start">
            {PROOF.map((p) => {
              const Icon = p.icon
              return (
                <li key={p.claim} className="flex gap-4 py-6">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-sm bg-brand/10 text-brand">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-balance">
                      {p.claim}
                    </p>
                    <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
                      {p.detail}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
