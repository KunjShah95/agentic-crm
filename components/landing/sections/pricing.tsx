import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Check, CreditCard, ReceiptText } from "lucide-react"

const PLANS = [
  { name: "Builder", price: "₹1,499", note: "per month · 1 project", receipt: "One site, from enquiry to possession", features: ["1 workspace · 1 project", "Unlimited contacts & deals", "Cost sheet 30s + RERA docs", "GPS + WhatsApp inbox"], cta: "Start Builder", featured: false },
  { name: "Team", price: "₹3,999", note: "per month · up to 6 staff", receipt: "Sales + Accounts + Site — same loop", features: ["3 workspaces · Owners + Sales + Brokers", "Roles: Owner/Admin/Sales/Broker/Viewer", "Invite + brokerScopeFilter + CLP", "NAAR pool trial · gu/hi"], cta: "Start Team — NAAR trial", featured: true },
  { name: "Network", price: "₹7,999", note: "per month · up to 12 staff · multi-site", receipt: "For 2–10 projects without Excel", features: ["Unlimited projects + Buyer portal", "Public sites + enquiry→scored lead", "UPI collection + Tally/PDF export", "Association exchange + referral ledger"], cta: "Set up Network", featured: false },
]

export function PricingSection({ isAuthed, workspaceSlug }: { isAuthed: boolean; workspaceSlug?: string | null }) {
  const cta = isAuthed ? `/${workspaceSlug}/contacts` : "/signup"
  return (
    <section id="pricing" className="mx-auto max-w-[1280px] px-6 pt-4 pb-14 lg:px-8 lg:pb-20">
      <div className="mt-10 grid items-start gap-4 overflow-visible pt-4 pb-3 lg:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p.name} className={`group relative min-w-0 overflow-visible flex flex-col transition-transform duration-300 ${p.featured ? "border-foreground bg-foreground text-background lg:-translate-y-2 hover:-translate-y-3" : "hover:-translate-y-1 border-border/60"}`}>
            {p.featured && <span className="absolute -top-3 left-6 rounded-full bg-background text-foreground font-mono text-[11px] tracking-[0.14em] px-3 py-1 border">MOST CHOSEN</span>}
            <CardHeader className="relative">
              <div className={`font-mono text-[11px] tracking-[0.16em] ${p.featured ? "text-background/60" : "text-muted-foreground"}`}>{p.name.toUpperCase()}</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1"><span className="text-[36px] font-bold leading-none tracking-tight">{p.price}</span><span className={`min-w-0 font-mono text-[11px] ${p.featured ? "text-background/60" : "text-muted-foreground"}`}>{p.note}</span></div>
              <div className={`mt-3 border-l-2 pl-3 text-[12px] leading-5 ${p.featured ? "border-background/40 text-background/70" : "border-border text-muted-foreground"}`}>{p.receipt}</div>
            </CardHeader>
            <CardContent className="flex-1 relative">
              <ul className={`space-y-2.5 text-[13px] ${p.featured ? "text-background/80" : "text-muted-foreground"}`}>{p.features.map((f) => (<li key={f} className="flex gap-2.5 items-center"><span className={`flex size-5 items-center justify-center rounded-full shrink-0 ${p.featured ? "bg-background text-foreground" : "bg-muted text-foreground border"}`}><Check className="size-3" /></span> {f}</li>))}</ul>
            </CardContent>
            <div className="p-6 pt-0 space-y-3 relative">
              <Button className={`w-full rounded-full gap-1.5 ${p.featured ? "bg-background text-foreground hover:bg-background/90" : ""}`} render={<Link href={cta} />}>{p.cta} <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" /></Button>
              <div className={`text-center font-mono text-[11px] ${p.featured ? "text-background/50" : "text-muted-foreground"}`}>14-day free · cancel anytime</div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-8 overflow-hidden border-border/70">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-foreground text-background"><CreditCard className="size-4" /></span>
            <div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-muted-foreground"><ReceiptText className="size-3" /> CHECKOUT, WITHOUT SURPRISES</div>
              <div className="text-sm font-medium">₹0 today · billing starts after your 14-day trial</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>Cancel anytime</span><span>·</span><span>CSV export included</span><span>·</span><span>Secure billing</span></div>
        </CardContent>
      </Card>
    </section>
  )
}
