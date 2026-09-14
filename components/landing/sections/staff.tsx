import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Phone, Handshake, Navigation, ReceiptText, Users } from "lucide-react"

const ROLES = [
  { role: "Owner / Director", icon: Building2, kpi: "₹2.4Cr weighted", desc: "Funnel, inventory health, collections, team vs target — Excel-free." },
  { role: "Sales Manager", icon: Phone, kpi: "HOLD→Booking 48s", desc: "Drag kanban, auto-log Activity, cost sheet 18s, WhatsApp ack." },
  { role: "Broker / CP", icon: Handshake, kpi: "Scoped % allocation", desc: "Sees only allocated units, commission auto-calc, referral ledger." },
  { role: "Site Engineer", icon: Navigation, kpi: "200m GPS", desc: "Schedule visit, check-in verified, offline PWA on field." },
  { role: "Accounts", icon: ReceiptText, kpi: "Demand 9s", desc: "CLP 8 milestones, RERA {{rera_no}}, UPI link → receipt, Tally CSV." },
]

export function StaffSection() {
  return (
    <section id="staff" className="border-y bg-muted/20">
      <div className="mx-auto max-w-[1280px] px-6 py-12 lg:px-8 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] text-muted-foreground"><Users className="size-3" /> STAFF · ONE LOOP, EVERY ROLE</span>
            <h2 className="mt-3 text-[30px] font-bold leading-[0.95] tracking-[-0.025em] sm:text-[38px]">Built for how Ahmedabad builds.</h2>
                        <p className="mt-3 max-w-[560px] text-[14px] leading-6 text-muted-foreground">One screen per role. Owners see revenue, collections and at-risk bookings. Sales see their leads, follow-ups, and today&apos;s visits. Brokers see only their allocation. Site verifies with GPS, Accounts sends RERA demands — same workspace, one loop. Gujarati + Hindi where the buyer reads it.</p>
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {ROLES.map((r) => (
            <Card key={r.role} className="group transition-transform duration-300 hover:-translate-y-0.5 overflow-hidden">
              <div className="h-px bg-border" />
              <CardHeader className="pb-2">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-foreground text-background"><r.icon className="size-4" /></span>
                <CardTitle className="text-[13px] leading-tight tracking-tight">{r.role}</CardTitle>
                <span className="w-fit font-mono text-[11px] text-muted-foreground">{r.kpi}</span>
              </CardHeader>
              <CardContent><p className="text-xs leading-5 text-muted-foreground">{r.desc}</p></CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
          <span>gu/hi templates</span><span>·</span><span>Slug-routed · workspaceId on every query</span>
        </div>
      </div>
    </section>
  )
}
