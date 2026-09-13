"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  Plus,
  Check,
  TrendingUp,
  ShieldCheck,
  MousePointer2,
  Clock3,
  Star,
  ChevronRight,
  Workflow,
  CreditCard,
  ReceiptText,
  MapPin,
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

// ——— MOCK DATA (kept, workspace-scoped loop) ———
type Stage = "lead" | "qualified" | "closing"
type Deal = { id: string; title: string; value: number; owner: string; stage: Stage; org: string }
type ActivityItem = { id: string; kind: "stage" | "call" | "task" | "note"; title: string; detail: string; time: string }

const WORKSPACES = {
  acme: {
    name: "Shilp Infra",
    slug: "acme",
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
  const [activeWs, setActiveWs] = useState<WsKey>("acme")
  const [deals, setDeals] = useState<Deal[]>(WORKSPACES.acme.deals)
  const [activities, setActivities] = useState<ActivityItem[]>(WORKSPACES.acme.activities)
  const [view, setView] = useState<"kanban" | "table">("kanban")
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropStage, setDropStage] = useState<Stage | null>(null)
  const [showWsMenu, setShowWsMenu] = useState(false)
  const [showWsMenuDark, setShowWsMenuDark] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const ws = WORKSPACES[activeWs]

  const switchWs = (key: WsKey) => {
    setActiveWs(key)
    setDeals(WORKSPACES[key].deals)
    setActivities(WORKSPACES[key].activities)
    setShowWsMenu(false)
    setShowWsMenuDark(false)
    setToast(`Switched to ${WORKSPACES[key].name} · /${WORKSPACES[key].slug}`)
    setTimeout(() => setToast(null), 2400)
  }

  useEffect(() => {
    // TypeUI Premium: cursor spotlight / parallax removed — motion is reserved for state changes
    const m = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (m.matches) return
  }, [])

  const moveDeal = (id: string, to: Stage) => {
    setDeals((prev) => {
      const deal = prev.find((d) => d.id === id)
      if (!deal || deal.stage === to) return prev
      const from = deal.stage
      const next = prev.map((d) => (d.id === id ? { ...d, stage: to } : d))
      const entry: ActivityItem = {
        id: Math.random().toString(36).slice(2, 7),
        kind: "stage",
        title: `Stage ${from} → ${to}`,
        detail: `${deal.title} moved by You · just now`,
        time: "now",
      }
      setActivities((a) => [entry, ...a.slice(0, 4)])
      setToast(`${deal.title} → ${to} · auto-logged`)
      setTimeout(() => setToast(null), 2200)
      return next
    })
  }

  const pipelineValue = useMemo(() => deals.reduce((s, d) => s + d.value, 0), [deals])

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
        {/* TOAST — shadcn style */}
        {toast && (
          <div className="pointer-events-none fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-full border bg-foreground px-4 py-2 text-sm font-medium text-background shadow-e3 animate-in fade-in slide-in-from-bottom-2">
            {toast}
          </div>
        )}

        <SiteHeader isAuthed={isAuthed} workspaceSlug={workspaceSlug} />

        {/* ────────────────────────────────────────────────
           HERO — CRAFTED BACKGROUND + KINETIC TITLE + CTAs
           ──────────────────────────────────────────────── */}
        <section ref={heroRef} className="relative overflow-hidden">
          {/* Signature motion: slow monochrome mesh, one accent, honors reduced-motion.
              Scrim keeps copy contrast + blends canvas edges into the page wash. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black_0%,black_55%,transparent_100%)]">
              <ShaderBackground className="absolute inset-0" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--hero-wash-from)]/70 via-[var(--hero-wash-to)]/40 to-background" />
          </div>

          <div className="relative mx-auto max-w-[1280px] px-6 lg:px-8">
            <div className="grid gap-10 pb-10 pt-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-8 lg:pb-16 lg:pt-[56px]">
              {/* LEFT — kinetic hero copy — Ahmedabad construction story */}
              <div className="relative">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 inline-flex items-center gap-2 rounded-full border bg-card/80 px-3.5 py-1.5">
                  <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                  <span className="text-[12px] font-medium tracking-[0.08em] text-muted-foreground">
                    REAL ESTATE CRM · BUILT FOR BUILDERS
                  </span>
                </div>
                <h1 className="mt-5 font-display text-[42px] font-[600] leading-[1.02] tracking-[-0.03em] text-balance sm:text-[54px] lg:text-[62px]">
                  <span className="block animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 [animation-fill-mode:both]">
                    Ahmedabad&apos;s sites.
                  </span>
                  <span className="block animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 [animation-fill-mode:both] text-foreground">
                    From foundation
                  </span>
                  <span className="block animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 [animation-fill-mode:both]">
                    to possession &mdash;{" "}
                    <span className="underline decoration-brand/70 decoration-[3px] underline-offset-8">on loop.</span>
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
                    render={<Link href="#workflow" />}
                  >
                    See how it works
                  </Button>

                  <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-success" /> No card required
                  </span>
                </div>

                {/* proof — capability, not vanity metrics */}
                <div className="mt-8 flex flex-wrap items-center gap-5 border-t border-border/60 pt-6 animate-in fade-in duration-500 delay-550 [animation-fill-mode:both]">
                  <div className="text-sm leading-tight">
                    <div className="font-medium tracking-tight">Foundation to possession, on one loop</div>
                    <div className="flex items-center gap-1 text-muted-foreground text-xs">Avg cost sheet <span className="tabular-nums">18s</span> · Excel-free · gu/hi</div>
                  </div>
                  <Separator orientation="vertical" className="hidden h-9 sm:block" />
                  <div className="hidden sm:flex items-center gap-2.5 text-[13px] leading-none text-muted-foreground">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-success/10 text-success border border-success/20"><FileCheck className="size-4" /></span>
                    <div>
                      <div className="font-medium text-foreground">RERA · DPDP · Postgres RLS</div>
                      <div>Audit every move · CLP 8 milestones</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT — Live specimen */}
              <div className="relative lg:pl-2">
                <div
                  className="relative overflow-visible rounded-[20px] border bg-card shadow-e3"
                >
                  {/* card header */}
                  <div className="flex items-center justify-between border-b bg-muted/35 px-4 py-3 backdrop-blur">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-background text-[11px] shadow-sm">
                        <Layers className="size-3.5" />
                      </span>
                      <div className="relative">
                        <Popover open={showWsMenu} onOpenChange={setShowWsMenu}>
                          <PopoverTrigger render={<Button variant="outline" size="sm" className="h-7 rounded-full gap-1.5 text-[11px] font-semibold tracking-[0.06em] bg-card hover:bg-card border-border/60 shadow-sm">
                              <span className="flex size-5 items-center justify-center rounded-full text-[10px] text-white shadow-sm" style={{ background: ws.color }}>{ws.letter}</span>
                              {ws.name.toUpperCase()} · /{ws.slug} <span className="text-muted-foreground text-[10px]">▾</span>
                            </Button>} />
                          <PopoverContent className="w-[260px] p-2" align="start">
                            <div className="font-mono text-[11px] tracking-widest text-muted-foreground px-2 py-1">WORKSPACES</div>
                            {(Object.keys(WORKSPACES) as WsKey[]).map((k) => (
                              <button
                                key={k}
                                onClick={() => switchWs(k)}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors ${k === activeWs ? "bg-accent ring-1 ring-border" : ""}`}
                              >
                                <span className="flex size-7 items-center justify-center rounded-full text-xs text-white shadow-sm" style={{ background: WORKSPACES[k].color }}>{WORKSPACES[k].letter}</span>
                                <span className="font-medium">{WORKSPACES[k].name}</span>
                                <span className="ml-auto font-mono text-[11px] text-muted-foreground">/{WORKSPACES[k].slug}</span>
                                {k === activeWs && <Check className="size-3.5 text-brand" />}
                              </button>
                            ))}
                            <Separator className="my-2" />
                            <div className="px-2 py-1 font-mono text-[11px] text-muted-foreground leading-relaxed">Every query scoped by <span className="text-foreground font-medium">workspaceId</span> — switching re-scopes the whole demo.</div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Badge variant="secondary" className="hidden sm:inline-flex gap-1 font-mono text-[10px] bg-success/10 text-success border-success/20">
                        <span className="size-1.5 rounded-full bg-success" aria-hidden /> LIVE
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant={view === "kanban" ? "default" : "outline"}
                        size="sm"
                        className="h-7 rounded-full font-mono text-[11px] gap-1 shadow-sm"
                        onClick={() => setView("kanban")}
                      ><LayoutGrid className="size-3" /> Kanban</Button>
                      <Button
                        variant={view === "table" ? "default" : "outline"}
                        size="sm"
                        className="h-7 rounded-full font-mono text-[11px] gap-1"
                        onClick={() => setView("table")}
                      ><TableIcon className="size-3" /> Table</Button>
                    </div>
                  </div>

                  {view === "kanban" ? (
                    <div className="grid grid-cols-3 gap-2 bg-muted/25 p-2.5 backdrop-blur">
                      {stageCols.map((col) => {
                        const colDeals = deals.filter((d) => d.stage === col.key)
                        const isDrop = dropStage === col.key
                        return (
                          <div
                            key={col.key}
                            onDragOver={(e) => { e.preventDefault(); setDropStage(col.key) }}
                            onDragLeave={() => setDropStage(null)}
                            onDrop={(e) => {
                              e.preventDefault()
                              const id = e.dataTransfer.getData("text/plain")
                              if (id) moveDeal(id, col.key)
                              setDropStage(null); setDragId(null)
                            }}
                            className={`rounded-2xl p-2 ring-1 transition-colors ${isDrop ? "bg-brand-soft ring-brand/50" : "bg-muted/25 ring-border hover:ring-border/80"}`}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground">{col.icon} {col.label.toUpperCase()}</span>
                              <Badge variant={isDrop ? "default" : "secondary"} className="h-5 px-1.5 font-mono text-[11px] rounded-full shadow-sm">{colDeals.length}</Badge>
                            </div>
                            <div className="space-y-2">
                              {colDeals.map((d) => (
                                <div
                                  key={d.id}
                                  draggable
                                  onDragStart={(e) => { setDragId(d.id); e.dataTransfer.setData("text/plain", d.id); e.dataTransfer.effectAllowed = "move" }}
                                  onDragEnd={() => { setDragId(null); setDropStage(null) }}
                                  className={`group cursor-grab rounded-xl border bg-card p-3 shadow-sm transition-all active:cursor-grabbing ${dragId === d.id ? "opacity-40 scale-[0.98] border-brand/40" : "border-border hover:border-foreground/25 hover:shadow-md"}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="text-[13px] font-medium leading-tight tracking-tight">{d.title}</div>
                                    <span className="hidden size-6 place-items-center rounded-full bg-muted text-[10px] group-hover:grid shrink-0"><MousePointer2 className="size-3" /></span>
                                  </div>
                                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">{d.org}</div>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="font-mono text-[11px] font-semibold tracking-tight text-brand tabular-nums">₹{(d.value / 100000).toFixed(1)}L</span>
                                    <span className="flex items-center gap-1.5">
                                      <span className="size-6 rounded-full bg-foreground text-center font-mono text-[10px] leading-6 text-background shadow-sm">{d.owner}</span>
                                      <Button
                                        size="sm"
                                        className="h-6 rounded-full px-2 font-mono text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                        onClick={() => {
                                          const next = col.key === "lead" ? "qualified" : col.key === "qualified" ? "closing" : "lead"
                                          moveDeal(d.id, next as Stage)
                                        }}
                                      >Move →</Button>
                                    </span>
                                  </div>
                                </div>
                              ))}
                              {isDrop && <div className="rounded-xl border-2 border-dashed border-brand/40 bg-brand-soft px-3 py-6 text-center font-mono text-[11px] font-medium text-brand">Drop to {col.label} → auto-log</div>}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full rounded-xl border-dashed bg-muted/20 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-solid transition-colors"
                                onClick={() => { const id = Math.random().toString(36).slice(2,6); const v = 15000+Math.floor(Math.random()*40000); setDeals(d => [...d, { id, title: `New Deal ${id}`, value: v, owner: "ME", stage: col.key, org: ws.name }]); setToast(`Added to ${col.label}`); setTimeout(()=>setToast(null),1500)}}
                              ><Plus className="size-3" /> Add deal</Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="bg-card p-2.5">
                      <div className="overflow-hidden rounded-2xl border shadow-sm">
                        <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.5fr] gap-px bg-border font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
                          <div className="bg-muted/50 px-3 py-2">DEAL</div><div className="bg-muted/50 px-3 py-2">ORG</div><div className="bg-muted/50 px-3 py-2">VALUE</div><div className="bg-muted/50 px-3 py-2">STAGE</div>
                        </div>
                        {deals.map((d) => (
                          <div key={d.id} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.5fr] gap-px bg-border text-sm">
                            <div className="bg-card px-3 py-2.5 font-medium tracking-tight">{d.title}</div>
                            <div className="bg-card px-3 py-2.5 text-muted-foreground text-xs">{d.org}</div>
                            <div className="bg-card px-3 py-2.5 font-mono text-brand text-xs tabular-nums">₹{d.value.toLocaleString("en-IN")}</div>
                            <div className="bg-card px-3 py-2.5">
                              <select value={d.stage} onChange={(e) => moveDeal(d.id, e.target.value as Stage)} className="rounded-full border bg-muted px-2 py-1 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring/40">
                                <option value="lead">Lead</option><option value="qualified">Qualified</option><option value="closing">Closing</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 border-t bg-card px-4 py-3">
                    <span className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground inline-flex items-center gap-1.5"><Clock3 className="size-3" /> ACTIVITY</span>
                    <Separator className="flex-1" />
                    <Badge className="rounded-md font-mono text-[10px] gap-1.5"><span className="size-1.5 rounded-full bg-success" aria-hidden /> Stage changes auto-logged</Badge>
                  </div>

                  {/* floating metrics — bento poppers */}
                  <div className="absolute -bottom-5 -left-3 hidden rounded-xl border bg-card px-4 py-3 shadow-e3 sm:flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand"><TrendingUp className="size-4" /></span>
                    <div><div className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground">PIPELINE · {ws.name.toUpperCase()}</div><div className="text-[15px] font-semibold tracking-tight tabular-nums">₹{(pipelineValue / 100000).toFixed(1)}L · {deals.length} deals</div></div>
                    <Progress value={Math.min(100, (pipelineValue / 50000000) * 100)} className="hidden lg:block w-16 h-1.5 ml-2" />
                  </div>
                  <div className="absolute -right-2 -top-3 hidden rounded-full border bg-card px-3 py-1.5 shadow-e2 sm:flex items-center gap-2">
                    <span className="size-2 rounded-full bg-success" aria-hidden /><span className="font-mono text-[11px] font-medium tracking-widest">SYNCED</span>
                  </div>
                </div>
                <p className="mx-auto mt-7 max-w-[440px] text-center text-[13px] leading-relaxed text-muted-foreground">Drag any card between columns — it logs activity, updates the timeline, and re-indexes everything instantly.</p>
              </div>
            </div>

            {/* STATS BAR — construction bento, hover spotlight */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[22px] border bg-border shadow-sm lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-600 [animation-fill-mode:both]">
              {[
                { k: "COST SHEET", v: "18 sec", sub: "base+GST+stamp+others → total", icon: ReceiptText, accent: "text-muted-foreground" },
                { k: "HOLD → BOOKING", v: "48 sec", sub: "KYC + 8 CLP milestones auto", icon: Hammer, accent: "text-brand" },
                { k: "SITE GPS", v: "200m", sub: "geofence verified check-in", icon: Navigation, accent: "text-muted-foreground" },
                { k: "RERA DEMAND #1", v: "9 sec", sub: "shortcodes → PDF download", icon: FileCheck, accent: "text-muted-foreground" },
              ].map((s) => (
                <div key={s.k} className="group relative overflow-hidden bg-card px-6 py-5 hover:bg-muted/40 transition-colors">
                  <div className="relative flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground"><s.icon className={`size-3 ${s.accent}`} /> {s.k}</div>
                  <div className="relative mt-1 text-[24px] font-semibold tracking-tight tabular-nums">{s.v}</div>
                  <div className="relative text-[12px] text-muted-foreground">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURE BENTO — shadcn Card + HoverCard + Popover + Tooltip spotlight */}
        <section id="product" className="mx-auto max-w-[1280px] px-6 py-14 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-[720px] text-center">
            <Badge variant="outline" className="rounded-full gap-1.5 text-[12px] tracking-[0.1em] text-foreground/70 border-border">
              <Hammer className="size-3" /> Product · built for construction
            </Badge>
            <h2 className="mt-3 text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[36px]">
              Excel ends. <span className="font-[500] italic text-muted-foreground">The loop begins.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-[560px] text-[14px] leading-6 text-muted-foreground">
              Project→Tower→Floor→Unit, cost sheets, CLP demand letters, broker scope, GPS site visits — not four tools, <span className="font-medium text-foreground">one construction loop</span>. Edit anywhere, RERA anywhere.{" "}
              <button onClick={() => setView("table")} className="inline-flex items-center gap-1 text-brand hover:text-foreground underline underline-offset-4 font-medium">See deals as a table — gu/hi too <ChevronRight className="size-3" /></button>
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-12 auto-rows-fr">
            {/* Large — contacts with hoverCard bento effect */}
            <Card className="bento-depth group relative overflow-hidden lg:col-span-7 flex flex-col justify-between hover:shadow-e2 hover:border-foreground/20 transition-colors border-border/60 h-full">
                <div className="absolute right-0 top-0 hidden h-[200px] w-[320px] rounded-bl-[28px] bg-muted/60 p-4 sm:block border-l border-b backdrop-blur">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground"><span>CONTACT</span><span className="h-px flex-1 bg-border" /><span className="text-brand">LIVE · {ws.name}</span></div>
                      <div className="rounded-xl border bg-card p-3 shadow-sm">
                        <div className="flex items-center gap-2"><Avatar className="size-7"><AvatarFallback className="bg-brand-soft text-brand text-[10px] font-medium">{ws.contacts[0]?.name?.split(" ").map((w) => w[0]).join("").slice(0, 2) ?? "—"}</AvatarFallback></Avatar><span className="text-sm font-medium">{ws.contacts[0]?.name}</span><Badge variant="secondary" className="ml-auto rounded-md text-[10px] bg-brand-soft text-brand border-brand/20">OWNER</Badge></div>
                        <div className="mt-3 flex gap-1.5"><Badge className="rounded-full font-mono text-[10px]"># {ws.contacts[0]?.tag}</Badge><Badge variant="outline" className="rounded-full font-mono text-[10px]"># warm</Badge><Badge variant="secondary" className="rounded-full font-mono text-[10px]">verified</Badge></div>
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
                      <Badge variant="outline" className="rounded-full font-mono text-[11px]">3 bulk actions</Badge>
                    </div>
                  </CardContent>
                </Card>

            {/* Dark card — organizations with popper */}
            <Card className="bento-depth group lg:col-span-5 bg-foreground text-background border-foreground overflow-hidden hover:shadow-e2 transition-colors relative h-full flex flex-col">
              <CardHeader className="relative">
                <div className="inline-flex size-9 items-center justify-center rounded-xl bg-background text-foreground shadow-sm"><Building2 className="size-4" /></div>
                <CardTitle className="text-background tracking-tight">Organizations that link themselves</CardTitle>
                <CardDescription className="text-background/60 leading-relaxed">Company profiles with linked contacts & deals. Estate360 suggests links by email domain — you confirm with one click.</CardDescription>
              </CardHeader>
              <CardContent className="relative flex-1 flex flex-col justify-end">
                <div className="rounded-xl bg-background/10 p-3.5 backdrop-blur border border-background/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.12em] text-background/60"><span>DOMAIN MATCH</span><span className="text-background font-medium tabular-nums">{activeWs === "acme" ? "94%" : activeWs === "vela" ? "88%" : "76%"} · AUTO-SUGGEST</span></div>
                  <Progress value={activeWs === "acme" ? 94 : activeWs === "vela" ? 88 : 76} className="mt-2 h-1.5 bg-background/10 [&>div]:bg-brand" />
                  <div className="mt-2.5 flex items-center gap-2 text-sm text-background font-medium"><span className="size-2 rounded-full bg-success" aria-hidden /> {activeWs === "acme" ? "shilp.co.in → 8 contacts · 3 deals" : activeWs === "vela" ? "safal.com → 5 contacts · 2 deals" : "galabuilders.in → 3 contacts"}</div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 w-full rounded-full font-medium shadow-sm"
                    onClick={() => { setToast("Linked 3 contacts → org"); setTimeout(()=>setToast(null),1800)}}
                  >Confirm links <ArrowRight className="size-3.5" /></Button>
                </div>
              </CardContent>
            </Card>

            {/* Deals — bento with tooltip popper */}
            <Card className="group lg:col-span-5 hover:shadow-e2 transition-colors border-border/60 overflow-hidden relative h-full">
              <CardHeader className="relative">
                <div className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand border border-brand/20"><Layers className="size-4" /></div>
                <CardTitle className="text-[16px] tracking-tight">Deals: board + table, same truth</CardTitle>
                <CardDescription className="leading-relaxed">Kanban drag-and-drop that logs activity automatically. Flip to table for sort, filter, and pipeline stats without losing context.</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="flex flex-wrap gap-2 font-mono text-[11px]">
                  <Tooltip>
                    <TooltipTrigger render={<Button variant={view==="kanban" ? "default" : "outline"} size="sm" className="rounded-full gap-1 shadow-sm" onClick={() => setView("kanban")}><LayoutGrid className="size-3" /> Kanban · interactive</Button>} />
                    <TooltipContent>Drag & drop simulation — live above. Also try Table view.</TooltipContent>
                  </Tooltip>
                  <Button variant={view==="table" ? "default" : "outline"} size="sm" className="rounded-full gap-1" onClick={() => setView("table")}><TableIcon className="size-3" /> Table</Button>
                  <Badge variant="outline" className="rounded-full gap-1 ml-auto hidden sm:inline-flex"><Workflow className="size-3" /> same data</Badge>
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
            <Card className="group lg:col-span-4 hover:shadow-e2 transition-colors border-border/60 relative overflow-hidden h-full flex flex-col">
              <CardHeader className="relative">
                <div className="inline-flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand border border-brand/20"><Zap className="size-4" /></div>
                <CardTitle className="text-[16px] tracking-tight">Activities that stay attached</CardTitle>
                <CardDescription className="leading-relaxed">Notes, emails, calls, meetings, tasks — on every record. “My Tasks” aggregates what&apos;s yours. <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border">source: manual | agent</span></CardDescription>
              </CardHeader>
              <CardContent className="relative flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="rounded-md gap-1 bg-success/10 text-success border-success/20"><Activity className="size-3" /> {activities.length} today</Badge>
                  <Badge variant="outline" className="rounded-md font-mono text-[10px]">{ws.contacts.length} contacts</Badge>
                  <Popover>
                    <PopoverTrigger render={<Button variant="outline" size="sm" className="ml-auto h-6 rounded-full text-[11px] gap-1 shadow-sm">Details <ChevronRight className="size-3" /></Button>} />
                    <PopoverContent align="end" className="w-72">
                      <div className="font-medium text-sm flex items-center gap-1.5"><Zap className="size-4 text-brand" /> Activity</div>
                      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">shadcn Popover — shows how activities are scoped to workspace and auto-logged on stage change. Try dragging a card.</div>
                      <Separator className="my-3" />
                      <div className="flex gap-1.5 flex-wrap">
                        {activities.slice(0,3).map(a => (
                          <Badge key={a.id} variant="secondary" className="font-mono text-[10px] rounded-full">{a.title}</Badge>
                        ))}
                      </div>
                      <Button size="sm" className="mt-3 w-full rounded-full gap-1" onClick={() => { const id=Math.random().toString(36).slice(2,6); setActivities(a=>[{ id, kind:"note", title:"Note added", detail:`“Estate360 demo note ${id}” — You · just now`, time:"now"}, ...a.slice(0,4)]); setToast("Note added → timeline"); setTimeout(()=>setToast(null),1500)}}><Plus className="size-3" /> Add demo note</Button>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-mono text-muted-foreground"><div className="size-2 rounded-full bg-success" aria-hidden /> live · auto-log on drop</div>
              </CardContent>
            </Card>

            {/* WhatsApp bento — fills the slot left by the removed search card */}
            <Card className="group lg:col-span-3 bg-brand-soft/60 border-brand/25 hover:border-brand/45 hover:shadow-e2 transition-colors relative overflow-hidden h-full flex flex-col">
              <CardHeader className="relative">
                <div className="font-mono text-[11px] tracking-[0.12em] text-brand flex items-center gap-1.5 font-semibold"><MessageSquare className="size-3" /> WHATSAPP</div>
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

        {/* STAFF — for Ahmedabad construction teams, every role on loop */}
        <section id="staff" className="border-y bg-muted/20">
          <div className="mx-auto max-w-[1280px] px-6 py-12 lg:px-8 lg:py-16">
            <div className="mx-auto flex max-w-[720px] flex-col items-center gap-3 text-center">
              <Badge variant="outline" className="rounded-full gap-1.5 text-[12px] tracking-[0.1em] border-border text-foreground/70"><Users className="size-3" /> STAFF · EVERY ROLE, ONE LOOP</Badge>
              <h2 className="text-[30px] font-bold leading-[0.95] tracking-[-0.025em] sm:text-[38px]">Built for how Ahmedabad builds.</h2>
              <p className="mx-auto max-w-[560px] text-[14px] leading-6 text-muted-foreground">Owner sees collections, Sales drags HOLD→Booking, Brokers see only their allocation, Site verifies GPS, Accounts sends RERA demand + UPI — same workspace, same audit, 5 voices, one loop. Gujarati + Hindi where it counts.</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {[                { role: "Owner / Director", icon: Building2, accent: "text-muted-foreground", kpi: "₹2.4Cr weighted", desc: "Funnel, inventory health, collections, team vs target — Excel-free." },
                { role: "Sales Manager", icon: Phone, accent: "text-brand", kpi: "HOLD→Booking 48s", desc: "Drag kanban, auto-log Activity, cost sheet 18s, WhatsApp ack." }, // brand = the one highlighted role
                { role: "Broker / CP", icon: Handshake, accent: "text-muted-foreground", kpi: "Scoped % allocation", desc: "Sees only allocated units, commission auto-calc, referral ledger." },
                { role: "Site Engineer", icon: Navigation, accent: "text-muted-foreground", kpi: "200m GPS", desc: "Schedule visit, check-in verified, offline PWA on field." },
                { role: "Accounts", icon: ReceiptText, accent: "text-muted-foreground", kpi: "Demand 9s", desc: "CLP 8 milestones, RERA {{rera_no}}, UPI link → receipt, Tally CSV." },
              ].map((r) => (
                <Card key={r.role} className="group hover:shadow-e2 hover:border-foreground/20 transition-colors overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-foreground via-foreground/60 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="pb-2">
                    <span className={`inline-flex size-8 items-center justify-center rounded-lg bg-muted border border-border/60 ${r.accent}`}><r.icon className="size-4" /></span>
                    <CardTitle className="text-[13px] leading-tight tracking-tight">{r.role}</CardTitle>
                    <Badge variant="secondary" className="w-fit rounded-md text-[11px] tabular-nums">{r.kpi}</Badge>
                  </CardHeader>
                  <CardContent><p className="text-xs leading-5 text-muted-foreground">{r.desc}</p></CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground"><span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1"><MapPin className="size-3" /> SG Highway · Bopal · South Bopal · Thaltej</span><span>·</span><span>gu/hi templates</span></div>
          </div>
        </section>

        {/* WORKFLOW — stepped bento */}
        <section id="workflow" className="border-y bg-card">
          <div className="mx-auto max-w-[1280px] px-6 py-12 lg:px-8 lg:py-16">
            <div className="mx-auto flex max-w-[720px] flex-col items-center gap-3 text-center">
              {/* Rhythm break: this section trades the mono-uppercase eyebrow
                  for display-italic — one variation to kill pattern fatigue. */}
              <span className="font-display text-[15px] italic text-muted-foreground">Three moves, one loop</span>
              <h2 className="text-[28px] font-bold tracking-[-0.02em] sm:text-[32px]">How the loop runs</h2>
            </div>
            <div className="relative mt-10 grid gap-6 lg:grid-cols-3">
              <div aria-hidden className="absolute left-6 right-6 top-[44px] hidden h-px bg-border lg:block"><div className="absolute inset-y-0 left-0 w-1/3 bg-brand" /></div>
              {[                { label: "CAPTURE", title: "Everything lands in one place", desc: "Contacts, orgs, and deals flow in. Tags, owners, and domains auto-link.", icon: Users, accent: "bg-foreground text-background" },
                { label: "MOVE", title: "Drag. It logs itself.", desc: "Move a deal — stage change becomes activity, timeline updates, search re-indexes.", icon: Layers, accent: "bg-brand text-brand-foreground" },
                { label: "CLOSE", title: "Activity → revenue, visibly", desc: "Every note and call stays attached. Your “My Tasks” is always current.", icon: Zap, accent: "bg-foreground text-background" },
              ].map((s) => (
                <Card key={s.label} className="bento-depth group relative hover:border-brand/40 hover:shadow-e2 transition-colors overflow-hidden">
                  <CardHeader className="relative">
                    <div className={`inline-flex size-10 items-center justify-center rounded-xl text-sm transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3 ${s.accent}`}><s.icon className="size-4" /></div>
                    <div className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground">{s.label}</div>
                    <CardTitle className="text-[18px] leading-tight tracking-tight">{s.title}</CardTitle>
                    <CardDescription className="leading-relaxed">{s.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>

            <Card className="mt-10 overflow-hidden border-foreground/10 bg-foreground text-background shadow-e3">
              <CardContent className="p-6 lg:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3"><span className="size-2 rounded-full bg-success" aria-hidden /><span className="font-mono text-[11px] tracking-[0.14em] text-background/60">LIVE WORKSPACE · {ws.name.toUpperCase()}</span><Separator orientation="vertical" className="hidden h-4 bg-background/15 sm:block" /><span className="hidden font-mono text-[11px] text-background/50 sm:inline">switch below — pipeline, timeline, search all re-scope</span></div>
                  <Badge variant="secondary" className="rounded-full font-mono text-[11px] tracking-widest gap-1 shadow-sm"><Workflow className="size-3" /> MULTI-TENANT · SLUG ROUTING</Badge>
                </div>
                <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                  <Card className="bg-background text-foreground shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between"><span className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground">DEAL TIMELINE · LIVE</span><Badge variant="secondary" className="font-mono text-[11px] rounded-full">{activities.length} activities</Badge></div>
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                      {activities.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 rounded-xl border bg-muted/50 px-3 py-2.5 animate-in fade-in slide-in-from-top-1 duration-300">
                          <Badge variant={r.kind==="stage" ? "default" : r.kind==="call" ? "secondary" : r.kind==="task" ? "destructive" : "outline"} className="rounded-full font-mono text-[10px] tracking-wide shadow-sm">{r.title}</Badge>
                          <span className="text-xs text-muted-foreground truncate">{r.detail}</span>
                          <span className="ml-auto font-mono text-[11px] text-muted-foreground shrink-0">{r.time}</span>
                        </div>
                      ))}
                      <Button variant="outline" className="w-full rounded-xl border-dashed font-mono text-xs hover:bg-muted" onClick={() => { const id=Math.random().toString(36).slice(2,6); setActivities(a=>[{ id, kind:"note", title:"Note added", detail:`“Estate360 demo note ${id}” — You · just now`, time:"now"}, ...a.slice(0,4)]); setToast("Note added → timeline"); setTimeout(()=>setToast(null),1500)}}><Plus className="size-3" /> Add note to {ws.name}</Button>
                    </CardContent>
                  </Card>
                  <div className="grid gap-3">
                    <Card className="border-background/10 bg-background/5 backdrop-blur text-background">
                      <CardHeader className="pb-2">
                        <div className="font-mono text-[11px] tracking-[0.16em] text-background/50">WORKSPACE SWITCHER</div>
                      </CardHeader>
                      <CardContent className="space-y-2.5">
                        <Popover open={showWsMenuDark} onOpenChange={setShowWsMenuDark}>
                          <PopoverTrigger render={<Button variant="secondary" className="w-full justify-start gap-2 rounded-xl h-11 shadow-sm">
                              <span className="flex size-7 items-center justify-center rounded-full text-xs text-white shadow-sm" style={{ background: ws.color }}>{ws.letter}</span>
                              <span className="text-sm font-medium">{ws.name}</span>
                              <span className="ml-auto font-mono text-[11px] text-muted-foreground">/{ws.slug} ▾</span>
                            </Button>} />
                          <PopoverContent className="w-[280px]" align="start">
                            {(Object.keys(WORKSPACES) as WsKey[]).map((k) => (
                              <button key={k} onClick={() => switchWs(k)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${k===activeWs ? "bg-accent ring-1 ring-border" : ""}`}>
                                <span className="flex size-7 items-center justify-center rounded-full text-xs text-white" style={{ background: WORKSPACES[k].color }}>{WORKSPACES[k].letter}</span>
                                <span>{WORKSPACES[k].name}</span><span className="ml-auto font-mono text-[11px] text-muted-foreground">/{WORKSPACES[k].slug}</span>{k===activeWs && <Check className="size-4 text-brand" />}
                              </button>
                            ))}
                            <Separator className="my-2" />
                            <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">All data re-scopes — pipeline, timeline, and search rebuild instantly.</div>
                          </PopoverContent>
                        </Popover>
                        <div className="space-y-1.5">
                          {(Object.keys(WORKSPACES) as WsKey[]).filter(k=>k!==activeWs).slice(0,2).map(k=> (
                            <button key={k} onClick={()=>switchWs(k)} className="flex w-full items-center gap-2 rounded-xl bg-background/10 px-3 py-2.5 text-left text-background/80 hover:bg-background/15 transition-colors border border-background/5">
                              <span className="flex size-7 items-center justify-center rounded-full bg-background/15 text-xs">{WORKSPACES[k].letter}</span>
                              <span className="text-sm">{WORKSPACES[k].name}</span><span className="ml-auto font-mono text-[11px]">/{WORKSPACES[k].slug}</span>
                            </button>
                          ))}
                        </div>
                        <div className="font-mono text-[11px] leading-4 text-background/50">Click to switch — pipeline, timeline, and search all update. Every query filtered by <span className="text-background font-medium">workspaceId</span>.</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-brand text-brand-foreground border-brand shadow-e2">
                      <CardHeader className="pb-2">
                        <div className="font-mono text-[11px] tracking-[0.14em] text-brand-foreground/70 inline-flex items-center gap-1.5"><ShieldCheck className="size-3" /> PERMISSIONS · RBAC</div>
                        <CardDescription className="text-brand-foreground/85 text-sm leading-5">Every server action checks <Kbd className="bg-background/15 text-brand-foreground border-brand-foreground/20 shadow-none">workspaceId</Kbd> and role — Owner / Admin / Member.</CardDescription>
                      </CardHeader>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* PRICING — bento cards with featured lift */}
        <section id="pricing" className="mx-auto max-w-[1280px] px-6 py-14 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-[720px] text-center">
            <Badge variant="outline" className="rounded-full tracking-[0.1em] border-border text-foreground/70 gap-1.5"><Building2 className="size-3" /> PRICING · FOR AHMEDABAD BUILDERS</Badge>
            <h2 className="mt-3 text-[32px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[36px]">Priced for site, not seat tricks.</h2>
            <p className="mx-auto mt-3 max-w-[580px] text-[14px] leading-6 text-muted-foreground">All plans include RERA shortcodes, CLP demand letters, GPS site visits, broker scope, WhatsApp gu/hi, and association pool. RERA export anytime — your data, your possession letter.</p>
          </div>
          <div className="mt-10 grid items-start gap-4 overflow-visible pt-4 pb-3 lg:grid-cols-3">
            {[
              { name: "Builder", price: "₹1,499", note: "per month · 1 project", receipt: "One site, from enquiry to possession", features: ["1 workspace · 1 project", "Unlimited contacts & deals", "Cost sheet 30s + RERA docs", "GPS + WhatsApp inbox"], cta: "Start Builder", featured: false },
              { name: "Team", price: "₹3,999", note: "per month · up to 6 staff", receipt: "Sales + Accounts + Site — same loop", features: ["3 workspaces · Owners + Sales + Brokers", "Roles: Owner/Admin/Sales/Broker/Viewer", "Invite + brokerScopeFilter + CLP", "NAAR pool trial · gu/hi"], cta: "Start Team — NAAR trial", featured: true },
              { name: "Network", price: "₹7,999", note: "per month · up to 12 staff · multi-site", receipt: "For 2–10 projects without Excel", features: ["Unlimited projects + Buyer portal", "Public sites + enquiry→scored lead", "UPI collection + Tally/PDF export", "Association exchange + referral ledger"], cta: "Set up Network", featured: false },
            ].map((p) => (
              <Card key={p.name} className={`group relative min-w-0 overflow-visible flex flex-col transition-all ${p.featured ? "border-brand bg-foreground text-background shadow-e3 lg:-translate-y-2 hover:shadow-e3" : "hover:shadow-e2 hover:border-foreground/20 border-border/60"}`}>
                {p.featured && <Badge className="absolute -top-3 left-6 rounded-full bg-brand text-brand-foreground font-mono text-[11px] tracking-[0.12em] px-3 py-1">MOST CHOSEN</Badge>}
                <CardHeader className="relative">
                  <div className={`font-mono text-[11px] tracking-[0.16em] ${p.featured ? "text-background/60" : "text-muted-foreground"}`}>{p.name.toUpperCase()}</div>
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
            ))}
          </div>
          <Card className="mt-8 overflow-hidden border-brand/25 bg-brand-soft/50">
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

        {/* MANIFESTO — testimonial bento */}
        <section id="manifesto" className="border-y bg-muted/30">
          <div className="mx-auto max-w-[1280px] px-6 py-12 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <Badge variant="outline" className="rounded-full tracking-[0.1em] border-border text-foreground/70 gap-1.5"><Building2 className="size-3" /> MANIFESTO</Badge>
                <h2 className="mt-3 text-[28px] font-semibold leading-[1.05] tracking-[-0.02em]">Possession isn&apos;t luck.<br />It&apos;s a loop that closes.</h2>
                <p className="mt-4 max-w-[460px] text-[14px] leading-6 text-muted-foreground">We verticalized Estate360 for NAAR: Shilp Infra to Gala Builders, 2–10 sites, SG Highway to South Bopal. Same workspace for Owners, Sales, Brokers, Site, Accounts — gu/hi where the buyer reads it, RERA where the auditor needs it.</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button className="rounded-full gap-1.5 shadow-sm" render={<Link href={isAuthed ? `/${workspaceSlug}/dashboard` : "/signup"} />}>Enter Estate360 — NAAR demo <ArrowRight className="size-4" /></Button>
                  {!isAuthed && (
                    <Button variant="outline" className="rounded-full bg-card" render={<Link href="/login" />}>Log in</Button>
                  )}
                  <Button variant="outline" className="rounded-full bg-card" render={<Link href={isAuthed ? `/${workspaceSlug}/dashboard` : "/login"} />}>See Shilp demo (/acme)</Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { q: "“Cost sheet in 18s, demand letter while the family is still at the site. That was Excel never.”", a: "— Hemal Shah, Shilp Infra, Director — 3 sites SG Highway" },
                  { q: "“GPS check-in killed fake visits. Our Site Engineers actually check in now.”", a: "— Nirav Doshi, Safal Corp, Site — 200m verified" },
                  { q: "“Brokers see only their allocation now. No more ‘who showed that unit?’ fights.”", a: "— Riya Desai, Gala Builders, CP Lead — NAAR exchange" },
                  { q: "“UPI link in the demand WhatsApp — collections before the 7th, Tally-ready.”", a: "— Accounts, Shilp Infra — CLP 8 milestones" },
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
        </section>

        <SiteFooter isAuthed={isAuthed} workspaceSlug={workspaceSlug} />
      </div>
    </TooltipProvider>
  )
}
