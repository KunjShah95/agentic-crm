import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
// Badge removed — landing uses plain typographic labels
import { Kbd } from "@/components/ui/kbd"
import { Progress } from "@/components/ui/progress"
import {
  ArrowUpRight,
  Layers,
  Zap,
  Activity,
  Building2,
  Users,
  ArrowRight,
  LayoutGrid,
  TableIcon,
  Check,
  TrendingUp,
  ShieldCheck,
  Star,
  ChevronRight,
  Workflow,
  CreditCard,
  ReceiptText,
  Hammer,
  FileCheck,
  Navigation,
  Phone,
  Handshake,
  MessageSquare,
} from "lucide-react"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/sections/site-footer"
import { ShaderBackground } from "@/components/landing/shader-background"
import { SpotlightGrid } from "@/components/landing/spotlight-grid"

// ——— MOCK DATA (kept, workspace-scoped loop) ———
type Stage = "lead" | "qualified" | "closing"
type Deal = { id: string; title: string; value: number; owner: string; stage: Stage; org: string }
type ActivityItem = { id: string; kind: "stage" | "call" | "task" | "note"; title: string; detail: string; time: string }

const WORKSPACES = {
  acme: {
    name: "Shilp Infra",
    slug: "shilp",
    letter: "S",
    color: "#0B1C3D",
    pipelineBase: 482000000,
    deals: [
      { id: "1", title: "Shaligram Lakeview 3BHK — A-301", value: 8200000, owner: "AE", stage: "lead" as Stage, org: "Shaligram Lakeview" },
      { id: "2", title: "Safal Solis A-102 →", value: 6100000, owner: "MJ", stage: "qualified" as Stage, org: "Safal Solis" },
      { id: "3", title: "Gala Marigold 2BHK — Hold", value: 4850000, owner: "MJ", stage: "closing" as Stage, org: "Gala Marigold" },
      { id: "4", title: "Orchid Heights 4BHK Penthouse", value: 11200000, owner: "PR", stage: "lead" as Stage, org: "Orchid Heights" },
      { id: "5", title: "Sangani Platinum 3BHK", value: 7400000, owner: "AE", stage: "qualified" as Stage, org: "Sangani" },
    ] as Deal[],
    activities: [
      { id: "a1", kind: "stage", title: "Stage → Qualified", detail: "A-102 moved by Maya · 2h ago - SG Highway visit done", time: "2h" },
      { id: "a2", kind: "call", title: "Call logged", detail: "Site follow-up — 14 min · RERA + carpet area shared", time: "4h" },
      { id: "a3", kind: "task", title: "Task · Demand #3", detail: "Due tomorrow · Accounts - CLP Milestone 4", time: "6h" },
    ] as ActivityItem[],
    contacts: [
      { name: "Hemal Shah", org: "Shaligram", tag: "3BHK" },
      { name: "Parth Mehta", org: "Safal Solis", tag: "SG-Highway" },
      { name: "Jinal Patel", org: "Gala Marigold", tag: "site-visit" },
    ],
  },
  vela: {
    name: "Safal Corp",
    slug: "vela",
    letter: "S",
    color: "#1A4D2E",
    pipelineBase: 298000,
    deals: [
      { id: "6", title: "Shilp Revanta 4BHK Penthouse", value: 9800000, owner: "AE", stage: "closing" as Stage, org: "Shilp Revanta" },
      { id: "7", title: "Aavkar Heights — 2BHK", value: 4200000, owner: "PR", stage: "lead" as Stage, org: "Aavkar Heights" },
      { id: "8", title: "Goyal Intercity — HOLD", value: 5400000, owner: "MJ", stage: "qualified" as Stage, org: "Goyal" },
      { id: "9", title: "Adani Shantigram 3BHK", value: 6700000, owner: "AE", stage: "lead" as Stage, org: "Shantigram" },
    ] as Deal[],
    activities: [
      { id: "b1", kind: "stage", title: "Stage → Closing", detail: "Revanta moved by Director · 30m ago - CLP Milestone 6", time: "30m" },
      { id: "b2", kind: "note", title: "Note added", detail: "“Possession Q2 2027” — buyer confirmation", time: "1h" },
      { id: "b3", kind: "task", title: "Task · Send Allotment letter", detail: "Due today · Owner", time: "3h" },
    ] as ActivityItem[],
    contacts: [
      { name: "Kaushal Vyas", org: "Shilp Revanta", tag: "4BHK" },
      { name: "Nirav Doshi", org: "Aavkar", tag: "SG-Highway" },
      { name: "Pooja Shah", org: "Shantigram", tag: "3BHK" },
    ],
  },
  solana: {
    name: "Gala Builders",
    slug: "solana",
    letter: "G",
    color: "#8B4513",
    pipelineBase: 156000,
    deals: [
      { id: "10", title: "Gala Luxuria Penthouse — 4BHK", value: 14500000, owner: "PR", stage: "lead" as Stage, org: "Gala Luxuria" },
      { id: "11", title: "Sankalp Grace — 2BHK", value: 3800000, owner: "MJ", stage: "lead" as Stage, org: "Sankalp Grace" },
      { id: "12", title: "Harita Enclave — Booking", value: 5200000, owner: "AE", stage: "qualified" as Stage, org: "Harita" },
    ] as Deal[],
    activities: [
      { id: "c1", kind: "call", title: "Call logged", detail: "Discovery — 14 min · Bopal site visit inbound", time: "1h" },
      { id: "c2", kind: "stage", title: "Stage → Qualified", detail: "Harita moved by You · just now - broker via NAAR pool", time: "now" },
    ] as ActivityItem[],
    contacts: [{ name: "Riya Desai", org: "Gala Luxuria", tag: "4BHK-penthouse" }],
  },
} as const

type WsKey = keyof typeof WORKSPACES
type Props = { workspaceSlug?: string | null; isAuthed: boolean }

export function LandingClient({ workspaceSlug, isAuthed }: Props) {
  // Static marketing snapshot — the landing renders one workspace, server-side.
  // No live simulation (drag/toast/switcher): that shipped a large client bundle
  // and janked on phones. The demo is now a static picture of the product.
  const activeWs: WsKey = "acme"
  const ws = WORKSPACES[activeWs]
  const deals = ws.deals
  const activities = ws.activities

  const stageCols: { key: Stage; label: string; icon: React.ReactNode }[] = [
    { key: "lead", label: "Lead", icon: <Users className="size-3" /> },
    { key: "qualified", label: "Qualified", icon: <Layers className="size-3" /> },
    { key: "closing", label: "Closing", icon: <TrendingUp className="size-3" /> },
  ]

  const base = "https://estate360.vercel.com"
  const landingJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Estate360",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: base,
      description: "Multi-tenant CRM: contacts, deals, inventory, HOLD→BOOKING→CLP, GPS site visits, broker scope, RERA docs, WhatsApp inbox, AI, reports, sites + buyer portal, and NAAR association shared pool.",
      offers: { "@type": "Offer", price: "1499", priceCurrency: "INR" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "What is Estate360?", acceptedAnswer: { "@type": "Answer", text: "Estate360 is a multi-tenant CRM for solo founders and small sales teams with workspace-scoped contacts, deals, projects, bookings, AI, and NAAR association pooled leads." } },
        { "@type": "Question", name: "How does HOLD→BOOKING work?", acceptedAnswer: { "@type": "Answer", text: "Hold → KYC → confirm booking auto-creates 8 CLP milestones and demand letter #1. No Excel, every transition logged as Activity." } },
        { "@type": "Question", name: "Is it workspace-scoped?", acceptedAnswer: { "@type": "Answer", text: "Yes. Every query filters by workspaceId and requireWorkspaceMember. Brokers see only allocated inventory. Association shared pool is association-scoped." } },
        { "@type": "Question", name: "Does it support Gujarati/Hindi?", acceptedAnswer: { "@type": "Answer", text: "Yes. WhatsApp templates and public sites have en/gu/hi variants." } },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to run a booking in Estate360",
      step: [
        { "@type": "HowToStep", name: "Create project & units", text: "Project→Tower→Floor→Unit or CSV import 200 units." },
        { "@type": "HowToStep", name: "Cost sheet", text: "Base+GST+stamp+others → total in <30s." },
        { "@type": "HowToStep", name: "Book", text: "Hold→KYC→Booking → 8 milestones → demand letter." },
      ],
    },
  ]

  return (
    <TooltipProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd).replace(/</g, "\\u003c") }} />
      <div className="bg-background text-foreground">
        <SiteHeader isAuthed={isAuthed} workspaceSlug={workspaceSlug} />

        {/* ────────────────────────────────────────────────
           HERO — CRAFTED BACKGROUND + KINETIC TITLE + CTAs
           ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Signature motion: slow monochrome mesh + cursor-revealed blueprint
              grid. Scrim keeps copy contrast + blends canvas edges into the wash. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
            <div className="absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black_0%,black_55%,transparent_100%)]">
              <ShaderBackground className="absolute inset-0" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--hero-wash-from)]/70 via-[var(--hero-wash-to)]/40 to-background" />
          </div>
          <SpotlightGrid className="-z-10" />

          <div className="relative mx-auto max-w-[1280px] px-6 lg:px-8">
            <div className="grid gap-10 pb-10 pt-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-8 lg:pb-16 lg:pt-[56px]">
              {/* LEFT — kinetic hero copy — Ahmedabad construction story */}
              <div className="relative">
                <h1 className="font-display text-[42px] font-[600] leading-[1.02] tracking-[-0.03em] text-balance sm:text-[54px] lg:text-[62px]">
                  <span className="block animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 [animation-fill-mode:both]">
                    Close bookings faster.
                  </span>
                  <span className="block animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 [animation-fill-mode:both] text-foreground">
                    RERA-ready.
                  </span>
                  <span className="block animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 [animation-fill-mode:both]">
                    <span className="text-brand">Cost sheets &amp; receipts</span>{" "}
                    &mdash;{" "}
                    <span className="underline decoration-brand/70 decoration-[3px] underline-offset-8">in seconds.</span>
                  </span>
                </h1>

                <p className="mt-5 max-w-[560px] text-[16px] leading-7 text-muted-foreground sm:text-[17px] animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 [animation-fill-mode:both]">
                  The complete <span className="font-semibold text-foreground">Real Estate CRM</span> for builders &amp; sales teams. Manage inventory, instant cost sheets, CLP booking milestones, RERA demand letters, and GPS site visits —{" "}
                  <span className="font-medium text-foreground underline decoration-brand/30 decoration-2 underline-offset-4">without Excel or data leaks.</span> Every action logged automatically.
                </p>
                {/* CTAs */}
                <div className="mt-7 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-450 [animation-fill-mode:both]">
                  <Button
                    size="lg"
                    className="rounded-full gap-2 h-11 px-7"
                    render={<Link href={isAuthed ? `/${workspaceSlug}/dashboard` : "/signup"} />}>
                    {isAuthed ? "Open your workspace" : "Start free in 30 seconds"}
                    <ArrowUpRight className="size-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-full gap-2 h-11 px-6 bg-card hover:bg-accent border-border/60"
                    render={<Link href={isAuthed ? `/${workspaceSlug}/dashboard` : "/signup"} />}
                  >
                    See how it works
                  </Button>

                  <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-success" /> No card required
                  </span>
                </div>
              </div>

              {/* RIGHT — the real product, in a browser frame (hero LCP image) */}
              <div className="relative lg:pl-2">
                <div className="relative overflow-hidden rounded-[20px] border bg-card shadow-e3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 [animation-fill-mode:both]">
                  {/* browser chrome */}
                  <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
                    <span className="flex gap-1.5">
                      <span className="size-2.5 rounded-full bg-foreground/15" />
                      <span className="size-2.5 rounded-full bg-foreground/15" />
                      <span className="size-2.5 rounded-full bg-foreground/15" />
                    </span>
                    <span className="ml-3 hidden rounded-md border bg-card px-3 py-1 font-mono text-[11px] text-muted-foreground sm:block">estate360.app/{ws.slug}/deals</span>
                  </div>
                  <Image
                    src="/product-deals.png"
                    alt="Estate360 deals board — live 6-stage pipeline in the /shilp workspace"
                    width={1262}
                    height={624}
                    priority
                    className="w-full"
                    sizes="(min-width: 1024px) 620px, 100vw"
                  />
                </div>
              </div>
            </div>

            {/* STATS BAR — construction bento, animated counters on scroll-in */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[22px] border bg-border shadow-sm lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-600 [animation-fill-mode:both]">
              {[
                { k: "Cost sheet", v: 18, suffix: " sec", sub: "base+GST+stamp+others → total", icon: ReceiptText, accent: "text-muted-foreground" },
                { k: "Hold → booking", v: 48, suffix: " sec", sub: "KYC + 8 CLP milestones auto", icon: Hammer, accent: "text-brand" },
                { k: "Site GPS", v: 200, suffix: "m", sub: "geofence verified check-in", icon: Navigation, accent: "text-muted-foreground" },
                { k: "RERA demand #1", v: 9, suffix: " sec", sub: "shortcodes → PDF download", icon: FileCheck, accent: "text-muted-foreground" },
              ].map((s) => (
                <div key={s.k} className="group relative overflow-hidden bg-card px-6 py-5 hover:bg-muted/40 transition-colors">
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="relative flex items-center gap-2 text-[12px] font-medium text-muted-foreground"><s.icon className={`size-3 ${s.accent}`} /> {s.k}</div>
                  <div className="relative mt-1 text-[24px] font-semibold tracking-tight tabular-nums">{s.v}{s.suffix}</div>
                  <div className="relative text-[12px] text-muted-foreground">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURE BENTO — shadcn Card + HoverCard + Popover + Tooltip spotlight */}
        <section id="product" className="mx-auto max-w-[1280px] px-6 py-14 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-[720px] text-center">
            <span className="inline-flex items-center gap-1.5 text-[12px] tracking-[0.1em] text-foreground/70">
              <Hammer className="size-3" /> Product · built for construction
            </span>
            <h2 className="mt-3 text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[36px]">
              Excel ends. <span className="font-[500] italic text-muted-foreground">The loop begins.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-[560px] text-[14px] leading-6 text-muted-foreground">
              Project→Tower→Floor→Unit, cost sheets, CLP demand letters, broker scope, GPS site visits — not four tools, <span className="font-medium text-foreground">one construction loop</span>. Edit anywhere, RERA anywhere.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-12 auto-rows-fr">
            {/* Large — contacts with hoverCard bento effect */}
            <Card className="bento-depth group relative overflow-hidden lg:col-span-7 flex flex-col justify-between border-transparent bg-gradient-to-br from-card to-muted/40 ring-1 ring-border shadow-e2 hover:shadow-e3 hover:ring-foreground/20 transition-all duration-300 h-full">
                <div className="absolute right-0 top-0 hidden h-[200px] w-[320px] rounded-bl-[28px] bg-muted/60 p-4 sm:block border-l border-b backdrop-blur">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><span>Contact</span><span className="h-px flex-1 bg-border" /><span className="text-brand">Live · {ws.name}</span></div>
                      <div className="rounded-xl border bg-card p-3 shadow-sm">
                        <div className="flex items-center gap-2"><Avatar className="size-7"><AvatarFallback className="bg-brand-soft text-brand text-[10px] font-medium">{ws.contacts[0]?.name?.split(" ").map((w) => w[0]).join("").slice(0, 2) ?? "—"}</AvatarFallback></Avatar><span className="text-sm font-medium">{ws.contacts[0]?.name}</span><span className="ml-auto text-[10px] font-medium text-brand">Owner</span></div>
                        <div className="mt-3 flex gap-2.5 font-mono text-[10px] text-muted-foreground"><span># {ws.contacts[0]?.tag}</span><span># warm</span><span>verified</span></div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground"><Progress value={74} className="h-1 flex-1" /> 74% complete</div>
                    </div>
                  </div>
                  <CardHeader className="relative max-w-[360px]">
                    <div className="inline-flex size-9 items-center justify-center rounded-xl bg-foreground text-background shadow-sm group-hover:scale-105 transition-transform"><Users className="size-4" /></div>
                    <CardTitle className="mt-3 tracking-tight">Contacts with memory</CardTitle>
                    <CardDescription className="text-[14px] leading-6">Searchable, filterable, sortable — with a unified activity timeline, tags, linked deals, and bulk actions that actually save time.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 font-mono text-[12px] text-muted-foreground">
                      <li className="flex gap-2"><span className="text-brand font-semibold">→</span> Bulk tag · assign owner · export CSV</li>
                      <li className="flex gap-2"><span className="text-brand font-semibold">→</span> Unified activity timeline on every contact</li>
                    </ul>
                    <div className="mt-4 flex gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">3 bulk actions</span>
                    </div>
                  </CardContent>
                </Card>

            {/* Dark card — organizations with popper */}
            <Card className="bento-depth group lg:col-span-5 bg-foreground text-background border-foreground overflow-hidden hover:-translate-y-1 hover:shadow-e3 transition-all duration-300 relative h-full flex flex-col">
              <CardHeader className="relative">
                <div className="inline-flex size-9 items-center justify-center rounded-xl bg-background text-foreground shadow-sm"><Building2 className="size-4" /></div>
                <CardTitle className="text-background tracking-tight">Organizations that link themselves</CardTitle>
                <CardDescription className="text-background/60 leading-relaxed">Company profiles with linked contacts & deals. Estate360 suggests links by email domain — you confirm with one click.</CardDescription>
              </CardHeader>
              <CardContent className="relative flex-1 flex flex-col justify-end">
                <div className="rounded-xl bg-background/10 p-3.5 backdrop-blur border border-background/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="flex items-center justify-between text-[12px] font-medium text-background/60"><span>Domain match</span><span className="text-background font-medium tabular-nums">{activeWs === "acme" ? "94%" : activeWs === "vela" ? "88%" : "76%"} · auto-suggest</span></div>
                  <Progress value={activeWs === "acme" ? 94 : activeWs === "vela" ? 88 : 76} className="mt-2 h-1.5 bg-background/10 [&>div]:bg-brand" />
                  <div className="mt-2.5 flex items-center gap-2 text-sm text-background font-medium"><span className="size-2 rounded-full bg-success" aria-hidden /> {activeWs === "acme" ? "shilp.co.in → 8 contacts · 3 deals" : activeWs === "vela" ? "safal.com → 5 contacts · 2 deals" : "galabuilders.in → 3 contacts"}</div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 w-full rounded-full font-medium shadow-sm"
                  >Confirm links <ArrowRight className="size-3.5" /></Button>
                </div>
              </CardContent>
            </Card>

            {/* Deals — bento with tooltip popper */}
            <Card className="group lg:col-span-5 border-l-2 border-l-brand/40 border-border/60 hover:-translate-y-1 hover:border-l-brand hover:shadow-e2 transition-all duration-300 overflow-hidden relative h-full">
              <CardHeader className="relative">
                <div className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand border border-brand/20"><Layers className="size-4" /></div>
                <CardTitle className="text-[16px] tracking-tight">Deals: board + table, same truth</CardTitle>
                <CardDescription className="leading-relaxed">Kanban drag-and-drop that logs activity automatically. Flip to table for sort, filter, and pipeline stats without losing context.</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="flex flex-wrap gap-2 font-mono text-[11px]">
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="default" size="sm" className="rounded-full gap-1 shadow-sm"><LayoutGrid className="size-3" /> Kanban</Button>} />
                    <TooltipContent>Board + table share one source of truth.</TooltipContent>
                  </Tooltip>
                  <Button variant="outline" size="sm" className="rounded-full gap-1"><TableIcon className="size-3" /> Table</Button>
                  <span className="ml-auto hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground"><Workflow className="size-3" /> same data</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {stageCols.map(c => {
                    const n = deals.filter(d=>d.stage===c.key).length
                    const pct = deals.length ? (n/deals.length)*100 : 0
                    return (
                      <div key={c.key} className="rounded-xl border bg-muted/30 p-3">
                        <div className="font-mono text-[10px] tracking-widest text-muted-foreground flex items-center gap-1">{c.icon} {c.label}</div>
                        <div className="mt-1 text-lg font-semibold tracking-tight">{n}</div>
                        <Progress value={pct} className="mt-2 h-1" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Activities — popover bento */}
            <Card className="group lg:col-span-4 hover:-translate-y-1 hover:shadow-e2 hover:border-foreground/20 transition-all duration-300 border-border/60 relative overflow-hidden h-full flex flex-col">
              <CardHeader className="relative">
                <div className="inline-flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand border border-brand/20"><Zap className="size-4" /></div>
                <CardTitle className="text-[16px] tracking-tight">Activities that stay attached</CardTitle>
                <CardDescription className="leading-relaxed">Notes, emails, calls, meetings, tasks — on every record. “My Tasks” aggregates what&apos;s yours. <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border">source: manual | agent</span></CardDescription>
              </CardHeader>
              <CardContent className="relative flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[12px] text-success"><Activity className="size-3" /> {activities.length} today</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{ws.contacts.length} contacts</span>
                  <Popover>
                    <PopoverTrigger render={<Button variant="outline" size="sm" className="ml-auto h-6 rounded-full text-[11px] gap-1 shadow-sm">Details <ChevronRight className="size-3" /></Button>} />
                    <PopoverContent align="end" className="w-72">
                      <div className="font-medium text-sm flex items-center gap-1.5"><Zap className="size-4 text-brand" /> Activity</div>
                      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">shadcn Popover — shows how activities are scoped to workspace and auto-logged on stage change. Try dragging a card.</div>
                      <Separator className="my-3" />
                      <div className="flex gap-1.5 flex-wrap">
                        {activities.slice(0,3).map(a => (
                          <span key={a.id} className="font-mono text-[10px] text-muted-foreground">{a.title}</span>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-mono text-muted-foreground"><div className="size-2 rounded-full bg-success" aria-hidden /> live · auto-log on drop</div>
              </CardContent>
            </Card>

            {/* WhatsApp bento — fills the slot left by the removed search card */}
            <Card className="group lg:col-span-3 bg-brand-soft/60 border-brand/25 hover:-translate-y-1 hover:border-brand/45 hover:shadow-e2 transition-all duration-300 relative overflow-hidden h-full flex flex-col">
              <CardHeader className="relative">
                <div className="text-[12px] text-brand flex items-center gap-1.5 font-semibold"><MessageSquare className="size-3" /> WhatsApp</div>
                <CardTitle className="text-[18px] leading-tight tracking-tight">Demand letters that send themselves</CardTitle>
                <CardDescription className="text-[13px] leading-5">RERA shortcodes fill the template, the UPI link rides along — gu/hi where the buyer reads it.</CardDescription>
              </CardHeader>
              <CardContent className="relative flex-1 flex flex-col justify-end">
                <div className="rounded-xl border bg-card p-3 text-[13px] shadow-sm">
                  <div className="font-medium">Demand #1 · ₹21,40,000</div>
                  <div className="mt-1 text-muted-foreground">Milestone 1 due · <span className="font-mono text-[12px] tabular-nums">{"{{rera_no}}"}</span> · UPI attached</div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"><span className="size-1.5 rounded-full bg-success" aria-hidden /> sent · receipt in 9s</div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* BOOKING WALKTHROUGH — one killer workflow, enquiry → possession, agent visible */}
        <section id="how" className="border-y bg-muted/20">
          <div className="mx-auto max-w-[1080px] px-6 py-14 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-[640px] text-center">
              <span className="inline-flex items-center gap-1.5 text-[13px] text-foreground/70"><Workflow className="size-3.5 text-brand" /> Enquiry to possession, one workflow</span>
              <h2 className="mt-3 text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[36px]">Watch a booking happen.</h2>
              <p className="mx-auto mt-3 max-w-[520px] text-[14px] leading-6 text-muted-foreground">One WhatsApp enquiry, seven steps, zero Excel. Each step logs itself — the agent does the searching and drafting, your team approves.</p>
            </div>

            <ol className="relative mx-auto mt-12 max-w-[720px]">
              {/* connecting spine — brand at the top, fading into the rail */}
              <span aria-hidden className="pointer-events-none absolute left-[27px] top-3 bottom-3 w-px bg-gradient-to-b from-brand via-brand/40 to-border" />
              {[
                { lane: "Buyer", actor: "WhatsApp enquiry", detail: "“3BHK available near SG Highway?”", icon: MessageSquare, agent: false, chat: true },
                { lane: "Agent", actor: "Matched inventory", detail: "3 live units · Shaligram Lakeview — reply drafted, waiting on approval", icon: Zap, agent: true },
                { lane: "Site", actor: "Visit — GPS verified", detail: "200m geofence check-in. No fake visits.", icon: Navigation, agent: false },
                { lane: "Sales", actor: "Hold → KYC → Booking", detail: "8 CLP milestones created automatically", icon: Hammer, agent: false },
                { lane: "Accounts", actor: "Cost sheet", detail: "base + GST + stamp + others → total", icon: ReceiptText, agent: false, time: "18s" },
                { lane: "Agent", actor: "RERA demand #1", detail: "shortcodes fill the template → PDF", icon: FileCheck, agent: true, time: "9s" },
                { lane: "Accounts", actor: "UPI collection → Possession", detail: "link rides the WhatsApp · receipt · Tally-ready", icon: CreditCard, agent: false },
              ].map((s, i) => (
                <li
                  key={s.actor}
                  className="relative flex gap-5 pb-5 last:pb-0 animate-in fade-in slide-in-from-bottom-2 [animation-fill-mode:both]"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {/* node on the spine */}
                  <div className="flex w-14 shrink-0 justify-center">
                    <span
                      className={`relative z-10 inline-flex size-9 items-center justify-center rounded-full transition-transform ${
                        s.agent
                          ? "bg-brand text-brand-foreground shadow-sm ring-4 ring-brand/15"
                          : "border-2 border-border bg-card text-foreground"
                      }`}
                    >
                      <s.icon className="size-4" />
                    </span>
                  </div>
                  {/* step card */}
                  <div className="group -mt-0.5 min-w-0 flex-1 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-foreground/20">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] text-muted-foreground">{s.lane}</span>
                      <span className="text-[14px] font-medium tracking-tight">{s.actor}</span>
                      {s.agent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] tracking-[0.1em] text-brand">
                          <Zap className="size-2.5" /> AGENT
                        </span>
                      )}
                      {s.time && (
                        <span className="ml-auto rounded-full border border-brand/25 bg-brand-soft/60 px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-brand">{s.time}</span>
                      )}
                    </div>
                    {s.chat ? (
                      <div className="mt-2 inline-flex max-w-full rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-[13px] leading-5 text-foreground">
                        {s.detail}
                      </div>
                    ) : (
                      <div className="mt-1 text-[13px] leading-5 text-muted-foreground">{s.detail}</div>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {/* outcome — reads like a receipt */}
            <div className="mx-auto mt-6 max-w-[720px] overflow-hidden rounded-2xl border border-brand/30 bg-foreground text-background shadow-e3">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground"><Check className="size-5" /></span>
                  <div>
                    <div className="text-[15px] font-semibold tracking-tight">Booking created</div>
                    <div className="font-mono text-[11px] tracking-[0.1em] text-background/60">Every step auto-logged · nothing typed twice</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] tracking-[0.14em] text-background/50">BOOKING VALUE</div>
                  <div className="text-[26px] font-semibold tabular-nums text-brand">₹82,00,000</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STAFF — for Ahmedabad construction teams, every role on loop */}
        <section id="staff" className="border-y bg-muted/20">
          <div className="mx-auto max-w-[1280px] px-6 py-12 lg:px-8 lg:py-16">
            <div className="mx-auto flex max-w-[720px] flex-col items-center gap-3 text-center">
              <span className="inline-flex items-center gap-1.5 text-[13px] text-foreground/70"><Users className="size-3.5 text-brand" /> Every role, one loop</span>
              <h2 className="text-[30px] font-bold leading-[0.95] tracking-[-0.025em] sm:text-[38px]">Built for how Ahmedabad builds.</h2>
              <p className="mx-auto max-w-[560px] text-[14px] leading-6 text-muted-foreground">Owner sees collections, Sales drags HOLD→Booking, Brokers see only their allocation, Site verifies GPS, Accounts sends RERA demand + UPI — same workspace, same audit, 5 voices, one loop. Gujarati + Hindi where it counts.</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {[                { role: "Owner / Director", icon: Building2, kpi: "₹2.4Cr weighted", desc: "Funnel, inventory health, collections, team vs target — Excel-free.", featured: false },
                { role: "Sales Manager", icon: Phone, kpi: "HOLD→Booking 48s", desc: "Drag kanban, auto-log Activity, cost sheet 18s, WhatsApp ack.", featured: true }, // the highlighted role — breaks the row
                { role: "Broker / CP", icon: Handshake, kpi: "Scoped % allocation", desc: "Sees only allocated units, commission auto-calc, referral ledger.", featured: false },
                { role: "Site Engineer", icon: Navigation, kpi: "200m GPS", desc: "Schedule visit, check-in verified, offline PWA on field.", featured: false },
                { role: "Accounts", icon: ReceiptText, kpi: "Demand 9s", desc: "CLP 8 milestones, RERA {{rera_no}}, UPI link → receipt, Tally CSV.", featured: false },
              ].map((r) => (
                <div key={r.role} className="h-full">
                  <Card
                    className={`group h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
                      r.featured
                        ? "border-brand/40 bg-brand-soft/30 shadow-e2 ring-1 ring-brand/15 lg:-translate-y-1.5 hover:shadow-e3"
                        : "border-border/60 hover:border-foreground/20 hover:shadow-e2"
                    }`}
                  >
                    <div className={`h-1 transition-opacity ${r.featured ? "bg-brand opacity-100" : "bg-gradient-to-r from-foreground via-foreground/60 to-transparent opacity-50 group-hover:opacity-100"}`} />
                    <CardHeader className="pb-2">
                      <span className={`inline-flex size-8 items-center justify-center rounded-lg border ${r.featured ? "border-brand/30 bg-brand text-brand-foreground" : "border-border/60 bg-muted text-muted-foreground"} transition-transform group-hover:scale-110`}><r.icon className="size-4" /></span>
                      <CardTitle className="text-[13px] leading-tight tracking-tight">{r.role}</CardTitle>
                      <span className={`w-fit text-[11px] tabular-nums ${r.featured ? "font-medium text-brand" : "text-muted-foreground"}`}>{r.kpi}</span>
                    </CardHeader>
                    <CardContent><p className="text-xs leading-5 text-muted-foreground">{r.desc}</p></CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WORKFLOW — stepped bento */}
        <section id="workflow" className="border-y bg-card">
          <div className="mx-auto max-w-[1280px] px-6 py-12 lg:px-8 lg:py-16">
            <div className="mx-auto flex max-w-[720px] flex-col items-center gap-3 text-center">
              <span className="font-display text-[15px] italic text-muted-foreground">Every query scoped to one workspace</span>
              <h2 className="text-[28px] font-bold tracking-[-0.02em] sm:text-[32px]">One workspace, cleanly scoped</h2>
              <p className="max-w-[520px] text-[14px] leading-6 text-muted-foreground">Pipeline, timeline, and search all scope to the active workspace. Every action stays logged and filtered by <span className="font-mono text-foreground">workspaceId</span>.</p>
            </div>

            <Card className="mt-10 overflow-hidden border-foreground/10 bg-foreground text-background shadow-e3">
              <CardContent className="p-6 lg:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3"><span className="size-2 rounded-full bg-success" aria-hidden /><span className="text-[12px] font-medium text-background/70">Live workspace · {ws.name}</span><Separator orientation="vertical" className="hidden h-4 bg-background/15 sm:block" /><span className="hidden font-mono text-[11px] text-background/50 sm:inline">pipeline, timeline, search — all workspace-scoped</span></div>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] tracking-widest text-background/60"><Workflow className="size-3" /> MULTI-TENANT · SLUG ROUTING</span>
                </div>
                <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                  <Card className="bg-background text-foreground shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between"><span className="text-[12px] font-medium text-muted-foreground">Deal timeline · live</span><span className="font-mono text-[11px] text-muted-foreground">{activities.length} activities</span></div>
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                      {activities.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 rounded-xl border bg-muted/50 px-3 py-2.5 animate-in fade-in slide-in-from-top-1 duration-300">
                          <span className="font-mono text-[10px] tracking-wide font-medium text-foreground shrink-0">{r.title}</span>
                          <span className="text-xs text-muted-foreground truncate">{r.detail}</span>
                          <span className="ml-auto font-mono text-[11px] text-muted-foreground shrink-0">{r.time}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <div className="grid gap-3">
                    <Card className="border-background/10 bg-background/5 backdrop-blur text-background">
                      <CardHeader className="pb-2">
                        <div className="text-[12px] font-medium text-background/60">Workspace switcher</div>
                      </CardHeader>
                      <CardContent className="space-y-2.5">
                        <div className="flex w-full items-center gap-2 rounded-xl bg-background/10 px-3 py-2.5 shadow-sm">
                          <span className="flex size-7 items-center justify-center rounded-full text-xs text-white shadow-sm" style={{ background: ws.color }}>{ws.letter}</span>
                          <span className="text-sm font-medium">{ws.name}</span>
                          <span className="ml-auto font-mono text-[11px] text-background/60">/{ws.slug}</span>
                        </div>
                        <div className="space-y-1.5">
                          {(Object.keys(WORKSPACES) as WsKey[]).filter(k=>k!==activeWs).slice(0,2).map(k=> (
                            <div key={k} className="flex w-full items-center gap-2 rounded-xl bg-background/10 px-3 py-2.5 text-background/80 border border-background/5">
                              <span className="flex size-7 items-center justify-center rounded-full bg-background/15 text-xs">{WORKSPACES[k].letter}</span>
                              <span className="text-sm">{WORKSPACES[k].name}</span><span className="ml-auto font-mono text-[11px]">/{WORKSPACES[k].slug}</span>
                            </div>
                          ))}
                        </div>
                        <div className="font-mono text-[11px] leading-4 text-background/50">Every query filtered by <span className="text-background font-medium">workspaceId</span> — pipeline, timeline, and search all scope to the active workspace.</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-brand text-brand-foreground border-brand shadow-e2">
                      <CardHeader className="pb-2">
                        <div className="text-[12px] font-medium text-brand-foreground/70 inline-flex items-center gap-1.5"><ShieldCheck className="size-3" /> Permissions · RBAC</div>
                        <CardDescription className="text-brand-foreground/85 text-sm leading-5">Every server action checks <Kbd className="bg-background/15 text-brand-foreground border-brand-foreground/20 shadow-none">workspaceId</Kbd> and role — Owner / Admin / Member.</CardDescription>
                      </CardHeader>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CALM BREATHER — one line, lots of air */}
        <section className="border-y bg-background">
          <div className="mx-auto flex min-h-[52vh] max-w-[900px] flex-col items-center justify-center px-6 py-24 text-center lg:py-32">
            <p className="text-[13px] font-medium tracking-wide text-muted-foreground">The whole point</p>
            <h2 className="mt-6 font-display text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] text-balance sm:text-[42px] lg:text-[48px]">
              One loop, from the first WhatsApp
              <br className="hidden sm:block" /> to the possession letter.
            </h2>
            <span aria-hidden className="mt-8 block h-[3px] w-[180px] rounded-full bg-brand" />
          </div>
        </section>

        {/* PRICING — bento cards with featured lift */}
        <section id="pricing" className="mx-auto max-w-[1280px] px-6 py-14 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-[720px] text-center">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/70"><Building2 className="size-3" /> Pricing</span>
            <h2 className="mt-3 text-[32px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[36px]">Priced for how builders work.</h2>
            <p className="mx-auto mt-3 max-w-[580px] text-[14px] leading-6 text-muted-foreground">All plans include RERA shortcodes, CLP demand letters, GPS site visits, broker scope, WhatsApp gu/hi, and association pool. RERA export anytime — your data, your possession letter.</p>
          </div>
          <div className="mt-10 grid items-start gap-4 overflow-visible pt-4 pb-3 lg:grid-cols-3">
            {[
              { name: "Builder", price: "₹1,499", note: "per month · 1 project", receipt: "One site, from enquiry to possession", features: ["1 workspace · 1 project", "Unlimited contacts & deals", "Cost sheet 30s + RERA docs", "GPS + WhatsApp inbox"], cta: "Start Builder", featured: false },
              { name: "Team", price: "₹3,999", note: "per month · up to 6 staff", receipt: "Sales + Accounts + Site — same loop", features: ["3 workspaces · Owners + Sales + Brokers", "Roles: Owner/Admin/Sales/Broker/Viewer", "Invite + brokerScopeFilter + CLP", "NAAR pool trial · gu/hi"], cta: "Start Team — NAAR trial", featured: true },
              { name: "Network", price: "₹7,999", note: "per month · up to 12 staff · multi-site", receipt: "For 2–10 projects without Excel", features: ["Unlimited projects + Buyer portal", "Public sites + enquiry→scored lead", "UPI collection + Tally/PDF export", "Association exchange + referral ledger"], cta: "Set up Network", featured: false },
            ].map((p) => (
              <div key={p.name} className="h-full">
              <Card className={`group relative h-full min-w-0 overflow-visible flex flex-col transition-all duration-300 ${p.featured ? "border-brand bg-foreground text-background shadow-e3 lg:-translate-y-2 hover:shadow-e3" : "hover:-translate-y-1 hover:shadow-e2 hover:border-foreground/20 border-border/60"}`}>
                {p.featured && <span className="absolute -top-3 left-6 rounded-full bg-brand text-brand-foreground text-[11px] font-medium px-3 py-1">Most chosen</span>}
                <CardHeader className="relative">
                  <div className={`text-[13px] font-semibold tracking-tight ${p.featured ? "text-background/70" : "text-muted-foreground"}`}>{p.name}</div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1"><span className="text-[36px] font-bold leading-none tracking-tight">{p.price}</span><span className={`min-w-0 font-mono text-[11px] ${p.featured ? "text-background/60" : "text-muted-foreground"}`}>{p.note}</span></div>
                  <div className={`mt-3 border-l-2 pl-3 text-[12px] leading-5 ${p.featured ? "border-brand text-background/70" : "border-brand/40 text-muted-foreground"}`}>{p.receipt}</div>
                </CardHeader>
                <CardContent className="flex-1 relative">
                  <ul className={`space-y-2.5 text-[13px] ${p.featured ? "text-background/80" : "text-muted-foreground"}`}>{p.features.map((f) => (<li key={f} className="flex gap-2.5 items-center"><span className={`flex size-5 items-center justify-center rounded-full shrink-0 ${p.featured ? "bg-brand text-brand-foreground" : "bg-brand-soft text-brand border border-brand/25"}`}><Check className="size-3" /></span> {f}</li>))}</ul>
                </CardContent>
                <div className="p-6 pt-0 space-y-3 relative">
                  <Button className={`w-full rounded-full gap-1.5 shadow-sm group-hover:shadow-md transition-shadow ${p.featured ? "bg-background text-foreground hover:bg-background/90" : ""}`} render={<Link href={isAuthed ? `/${workspaceSlug}/dashboard` : "/signup"} />}>{p.cta} <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" /></Button>
                  <div className={`text-center font-mono text-[11px] ${p.featured ? "text-background/50" : "text-muted-foreground"}`}>14-day free · cancel anytime</div>
                </div>
              </Card>
              </div>
            ))}
          </div>
          <Card className="mt-8 overflow-hidden border-brand/25 bg-brand-soft/50">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-foreground text-background"><CreditCard className="size-4" /></span>
                <div>
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground"><ReceiptText className="size-3" /> Checkout, without surprises</div>
                  <div className="text-sm font-medium">₹0 today · billing starts after your 14-day trial</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>Cancel anytime</span><span>·</span><span>CSV export included</span><span>·</span><span>Secure billing</span></div>
            </CardContent>
          </Card>
        </section>

        {/* MANIFESTO — testimonial bento */}
        <section id="manifesto" className="border-y bg-muted/30">
          <div className="mx-auto max-w-[1280px] px-6 py-12 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[13px] text-foreground/70"><Building2 className="size-3.5 text-brand" /> Why we built it</span>
                <h2 className="mt-3 text-[28px] font-semibold leading-[1.05] tracking-[-0.02em]">Possession isn&apos;t luck.<br />It&apos;s a loop that closes.</h2>
                <p className="mt-4 max-w-[460px] text-[14px] leading-6 text-muted-foreground">Estate360 is built for how Indian real estate actually runs — 2–10 sites, SG Highway to South Bopal. One workspace for Owners, Sales, Brokers, Site, Accounts — gu/hi where the buyer reads it, RERA where the auditor needs it.</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button className="rounded-full gap-1.5 shadow-sm" render={<Link href={isAuthed ? `/${workspaceSlug}/dashboard` : "/signup"} />}>Enter Estate360 — NAAR demo <ArrowRight className="size-4" /></Button>
                  {!isAuthed && (
                    <Button variant="outline" className="rounded-full bg-card" render={<Link href="/login" />}>Log in</Button>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground">
                  <span className="rounded-full border border-border/70 bg-card px-2 py-0.5">Illustrative</span>
                  Sample workspaces — not customer quotes
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { q: "“Cost sheet in 18s, demand letter while the family is still at the site. That was Excel never.”", a: "Sample — Director, 3-site builder · SG Highway" },
                    { q: "“GPS check-in killed fake visits. Site Engineers actually check in now.”", a: "Sample — Site Engineer · 200m geofence" },
                    { q: "“Brokers see only their allocation. No more ‘who showed that unit?’ fights.”", a: "Sample — CP Lead · NAAR exchange" },
                    { q: "“UPI link in the demand WhatsApp — collections before the 7th, Tally-ready.”", a: "Sample — Accounts · CLP 8 milestones" },
                  ].map((t) => (
                    <Card key={t.q} className="group hover:border-foreground/20 transition-colors border-border/60 overflow-hidden relative">
                      <CardContent className="p-5 relative">
                        <div className="text-[15px] font-medium leading-snug tracking-tight">{t.q}</div>
                        <div className="mt-2 font-mono text-[11px] text-muted-foreground flex items-center gap-1"><Star className="size-3 fill-brand text-brand" /> {t.a}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <SiteFooter isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
      </div>
    </TooltipProvider>
  )
}
