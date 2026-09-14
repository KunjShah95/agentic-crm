import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Building2, Star } from "lucide-react"

const QUOTES = [
  { q: "“Cost sheet in 18s, demand letter while the family is still at the site. That was Excel never.”", a: "— Hemal Shah, Shilp Infra, Director — 3 sites SG Highway" },
  { q: "“GPS check-in killed fake visits. Our Site Engineers actually check in now.”", a: "— Nirav Doshi, Safal Corp, Site — 200m verified" },
  { q: "“Brokers see only their allocation now. No more ‘who showed that unit?’ fights.”", a: "— Riya Desai, Gala Builders, CP Lead — NAAR exchange" },
  { q: "“UPI link in the demand WhatsApp — collections before the 7th, Tally-ready.”", a: "— Accounts, Shilp Infra — CLP 8 milestones" },
]

export function ManifestoSection({ isAuthed, workspaceSlug }: { isAuthed: boolean; workspaceSlug?: string | null }) {
  const cta = isAuthed ? `/${workspaceSlug}/contacts` : "/signup"
  return (
    <section id="manifesto" className="border-y bg-muted/30">
      <div className="mx-auto max-w-[1280px] px-6 py-12 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-muted-foreground"><Building2 className="size-3" /> MANIFESTO · AHMEDABAD BUILDS, LOOP RUNS</span>
            <h2 className="mt-3 text-[28px] font-bold leading-[0.95] tracking-[-0.02em]">Possession isn&apos;t luck.<br />It&apos;s a loop that closes.</h2>
            <p className="mt-4 max-w-[460px] text-[14px] leading-6 text-muted-foreground">We verticalized Estate360 for NAAR: Shilp Infra to Gala Builders, 2–10 sites, SG Highway to South Bopal. Same workspace for Owners, Sales, Brokers, Site, Accounts — gu/hi where the buyer reads it, RERA where the auditor needs it.</p>
            <div className="mt-6 flex gap-3">
              <Button className="rounded-full gap-1.5" render={<Link href={cta} />}>Enter Estate360 — NAAR demo <ArrowRight className="size-4" /></Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUOTES.map((t) => (
              <Card key={t.q} className="group transition-transform hover:-translate-y-0.5 border-border/60 overflow-hidden">
                <CardContent className="p-5">
                  <div className="text-[15px] font-medium leading-snug tracking-tight">{t.q}</div>
                  <div className="mt-2 font-mono text-[11px] text-muted-foreground flex items-center gap-1"><Star className="size-3 fill-foreground text-foreground" /> {t.a}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
