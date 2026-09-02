"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Kbd } from "@/components/ui/kbd"
import { Progress } from "@/components/ui/progress"
import { ModeToggle } from "@/components/shell/mode-toggle"
import {
  ArrowUpRight,
  Search,
  Sparkles,
  Layers,
  Zap,
  Activity,
  Building2,
  Users,
  ArrowRight,
  Command as CommandIcon,
  LayoutGrid,
  TableIcon,
  Plus,
  Check,
  TrendingUp,
  ShieldCheck,
  MousePointer2,
  Clock3,
  Star,
  Play,
  ChevronRight,
  ExternalLink,
  Workflow,
  Radar,
  Gauge,
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
      { id: "b3", kind: "task", title: "Task · Send Allotment + eSign", detail: "Due today · Owner", time: "3h" },
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [view, setView] = useState<"kanban" | "table">("kanban")
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropStage, setDropStage] = useState<Stage | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showWsMenu, setShowWsMenu] = useState(false)
  const [showWsMenuDark, setShowWsMenuDark] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const [spot, setSpot] = useState({ x: 50, y: 30 })
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
    const el = heroRef.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      setParallax({ x: (e.clientX - cx) / 52, y: (e.clientY - cy) / 64 })
      setSpot({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 })
    }
    const m = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (m.matches) return
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
      if (e.key === "Escape") setSearchOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
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

  const filteredSearch = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return { deals, contacts: ws.contacts, activities }
    return {
      deals: deals.filter((d) => `${d.title} ${d.org} ${d.value}`.toLowerCase().includes(q)),
      contacts: ws.contacts.filter((c) => `${c.name} ${c.org} ${c.tag}`.toLowerCase().includes(q)),
      activities: activities.filter((a) => `${a.title} ${a.detail}`.toLowerCase().includes(q)),
    }
  }, [searchQuery, deals, activities, ws.contacts])

  const stageCols: { key: Stage; label: string; icon: React.ReactNode }[] = [
    { key: "lead", label: "Lead", icon: <Users className="size-3" /> },
    { key: "qualified", label: "Qualified", icon: <Layers className="size-3" /> },
    { key: "closing", label: "Closing", icon: <TrendingUp className="size-3" /> },
  ]

  const base = "https://loopcrm.example.com"
  const landingJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Loop CRM",
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
        { "@type": "Question", name: "What is Loop CRM?", acceptedAnswer: { "@type": "Answer", text: "Loop CRM is a multi-tenant CRM for solo founders and small sales teams with workspace-scoped contacts, deals, projects, bookings, AI, and NAAR association pooled leads." } },
        { "@type": "Question", name: "How does HOLD→BOOKING work?", acceptedAnswer: { "@type": "Answer", text: "Hold → KYC → confirm booking auto-creates 8 CLP milestones and demand letter #1. No Excel, every transition logged as Activity." } },
        { "@type": "Question", name: "Is it workspace-scoped?", acceptedAnswer: { "@type": "Answer", text: "Yes. Every query filters by workspaceId and requireWorkspaceMember. Brokers see only allocated inventory. Association shared pool is association-scoped." } },
        { "@type": "Question", name: "Does it support Gujarati/Hindi?", acceptedAnswer: { "@type": "Answer", text: "Yes. WhatsApp templates and public sites have en/gu/hi variants." } },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to run a booking in Loop CRM",
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
      <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
        {/* TOAST — shadcn style */}
        {toast && (
          <div className="pointer-events-none fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-full border bg-foreground px-4 py-2 text-sm font-medium text-background shadow-[0_16px_40px_rgba(0,0,0,0.18)] animate-in fade-in slide-in-from-bottom-2">
            {toast}
          </div>
        )}

        {/* COMMAND PALETTE */}
        <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
          <CommandInput placeholder={`Search ${ws.name} — try “Atlas”, “Helios”, or “call”`} value={searchQuery} onValueChange={setSearchQuery} />
          <CommandList>
            <CommandEmpty>No results for “{searchQuery}” in {ws.name}</CommandEmpty>
            <CommandGroup heading={`Deals · ${filteredSearch.deals.length}`}>
              {filteredSearch.deals.map((d) => (
                <CommandItem
                  key={d.id}
                  value={`${d.title} ${d.org}`}
                  onSelect={() => {
                    setSearchOpen(false)
                    setToast(`Opened ${d.title}`)
                    setTimeout(() => setToast(null), 1500)
                  }}
                >
                  <Building2 className="size-4 text-muted-foreground" />
                  <span>{d.title}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">₹{(d.value / 100000).toFixed(1)}L · {d.stage}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={`Contacts · ${filteredSearch.contacts.length}`}>
              {filteredSearch.contacts.map((c) => (
                <CommandItem key={c.name} value={c.name}>
                  <Users className="size-4 text-muted-foreground" />
                  <span>
                    {c.name} <span className="text-muted-foreground">· {c.org}</span>
                  </span>
                  <Badge variant="secondary" className="ml-auto font-mono text-[10px]">#{c.tag}</Badge>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={`Activity · ${filteredSearch.activities.length}`}>
              {filteredSearch.activities.map((a) => (
                <CommandItem key={a.id} value={a.title}>
                  <Activity className="size-4 text-muted-foreground" />
                  <span>{a.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{a.time}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between border-t bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> open · <Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
            <Badge variant="outline" className="font-mono">/{activeWs}</Badge>
          </div>
        </CommandDialog>

        {/* NAV — glass + beam */}
        <header className="sticky top-0 z-40 border-b bg-background/65 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/55">
          <div className="mx-auto flex h-[64px] w-full max-w-[1280px] items-center justify-between px-6 lg:px-8">
            <div className="flex items-center gap-8">
              <Link href="/" className="group flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background shadow-sm group-hover:shadow-md transition-shadow">
                  <Layers className="size-4" />
                </span>
                <span className="text-[13px] font-semibold tracking-[0.18em]">LOOP</span>
                <span className="hidden text-[13px] font-light tracking-[0.12em] text-muted-foreground sm:inline">CRM</span>
                <Badge variant="secondary" className="hidden lg:inline-flex ml-1 rounded-full font-mono text-[10px] tracking-widest gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> PHASE 1
                </Badge>
              </Link>
              <nav className="hidden items-center gap-6 text-[13px] font-medium md:flex">
                <a href="#product" className="text-muted-foreground hover:text-foreground transition-colors">Product</a>
                <a href="#workflow" className="text-muted-foreground hover:text-foreground transition-colors">Workflow</a>
                <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
                <a href="#manifesto" className="text-muted-foreground hover:text-foreground transition-colors">Manifesto</a>
              </nav>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Button variant="outline" size="sm" className="hidden lg:inline-flex rounded-full gap-2 bg-card hover:bg-card border-border/60" onClick={() => setSearchOpen(true)}>
                <Search className="size-3.5" /> Search <Kbd className="ml-1 bg-muted">⌘K</Kbd>
              </Button>
              <ModeToggle />
              {!isAuthed ? (
                <>
                  <Button variant="ghost" size="sm" className="rounded-full" render={<Link href="/login" />}>Sign in</Button>
                  <Button size="sm" className="rounded-full gap-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.16)] hover:-translate-y-px transition-all" render={<Link href="/signup" />}>Start free — 14 days <ArrowUpRight className="size-3.5" /></Button>
                </>
              ) : (
                <Button size="sm" className="rounded-full gap-1.5" render={<Link href={`/${workspaceSlug}/contacts`} />}>Go to workspace <ArrowRight className="size-3.5" /></Button>
              )}
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden rounded-full"
            >
              <span className="text-sm">{mobileOpen ? "✕" : "≡"}</span>
            </Button>
          </div>
          <div className="relative h-px w-full overflow-hidden bg-border">
            <div className="absolute inset-y-0 left-0 w-[38%] bg-gradient-to-r from-violet-500 via-blue-500 to-transparent opacity-60" />
            <div className="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.7)] animate-[loopRun_7s_linear_infinite]" />
          </div>
          {mobileOpen && (
            <div className="border-t bg-popover px-6 py-6 md:hidden animate-in fade-in slide-in-from-top-2">
              <nav className="flex flex-col gap-3 text-sm font-medium">
                <a href="#product" onClick={() => setMobileOpen(false)} className="py-2">Product</a>
                <a href="#workflow" onClick={() => setMobileOpen(false)} className="py-2">Workflow</a>
                <a href="#pricing" onClick={() => setMobileOpen(false)} className="py-2">Pricing</a>
                <Button variant="outline" className="rounded-full" onClick={() => setSearchOpen(true)}><Search className="size-4" /> Search</Button>
                <Button className="rounded-full mt-2" render={<Link href={isAuthed ? `/${workspaceSlug}/contacts` : "/signup"} />}>{isAuthed ? "Open workspace" : "Start free"}</Button>
              </nav>
            </div>
          )}
        </header>

        {/* ────────────────────────────────────────────────
           HERO — CRAFTED BACKGROUND + KINETIC TITLE + CTAs
           ──────────────────────────────────────────────── */}
        <section ref={heroRef} className="relative overflow-hidden">
          {/* Beautiful mesh + grid + spotlight background */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-background" />
            {/* Base amber/violet wash like reference */}
            <div className="absolute inset-0 bg-gradient-to-b from-amber-50/40 via-transparent to-transparent dark:from-amber-950/10 dark:via-transparent" />
            {/* Aurora — large soft blobs */}
            <div className="absolute -top-[22%] left-[52%] h-[980px] w-[1280px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.18),rgba(59,130,246,0.14)_42%,rgba(6,182,212,0.08)_72%,transparent_72%)] blur-[18px] dark:opacity-80 animate-[aurora_18s_ease-in-out_infinite]" />
            <div className="absolute top-[6%] -right-[8%] h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle_at_center,rgba(236,72,153,0.16),rgba(251,146,60,0.10)_55%,transparent_70%)] blur-[22px] animate-[aurora2_22s_ease-in-out_infinite]" />
            <div className="absolute top-[14%] -left-[10%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.14),transparent_68%)] blur-[16px]" />
            {/* Subtle dot grid */}
            <div
              className="absolute inset-0 opacity-[0.045] dark:opacity-[0.07]"
              style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, var(--foreground) 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            />
            {/* hairline grid */}
            <div
              className="absolute inset-0 opacity-[0.03] dark:opacity-[0.055]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
                backgroundSize: "72px 72px",
              }}
            />
            {/* spotlight following cursor */}
            <div
              className="absolute inset-0 transition-opacity duration-300"
              style={{
                background: `radial-gradient(620px circle at ${spot.x}% ${spot.y}%, rgba(139,92,246,0.14), transparent 58%)`,
              }}
            />
            <div
              className="absolute inset-0 hidden lg:block"
              style={{
                background: `radial-gradient(420px circle at ${spot.x}% ${spot.y}%, rgba(59,130,246,0.10), transparent 60%)`,
              }}
            />
            {/* vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
            {/* noise */}
            <div className="absolute inset-0 opacity-[0.015] mix-blend-multiply" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E")` }} />
          </div>

          <div className="relative mx-auto max-w-[1280px] px-6 lg:px-8">
            <div className="grid gap-10 pb-10 pt-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-8 lg:pb-16 lg:pt-[56px]">
              {/* LEFT — kinetic hero copy — Ahmedabad construction story */}
              <div className="relative">
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 inline-flex items-center gap-2 rounded-full border bg-card/90 backdrop-blur px-3 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse [animation-delay:300ms]" />
                    <span className="size-1.5 rounded-full bg-violet-500 animate-pulse [animation-delay:600ms]" />
                  </span>
                  <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground">
                    FOR AHMEDABAD BUILDERS · NAAR MEMBERS · 2–10 PROJECTS
                  </span>
                  <Badge variant="secondary" className="ml-1 hidden sm:inline-flex gap-1 rounded-full font-mono text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
                    <MapPin className="size-3" /> SG HIGHWAY · BOPAL · SOUTH BOPAL
                  </Badge>
                </div>
                <h1 className="mt-6 text-[42px] font-[780] leading-[0.86] tracking-[-0.04em] sm:text-[54px] lg:text-[62px]">
                  <span className="block animate-in fade-in slide-in-from-bottom-3 duration-700 delay-100 [animation-fill-mode:both]">
                    Ahmedabad&apos;s sites.
                  </span>
                  <span className="block animate-in fade-in slide-in-from-bottom-3 duration-700 delay-150 [animation-fill-mode:both] text-foreground">
                    From foundation
                  </span>
                  <span className="block animate-in fade-in slide-in-from-bottom-3 duration-700 delay-200 [animation-fill-mode:both] bg-gradient-to-r from-[#0B1C3D] via-[#1A4D2E] to-[#C27803] bg-clip-text text-transparent dark:from-violet-400 dark:via-amber-300 dark:to-emerald-300">
                    to possession — on loop.
                  </span>
                </h1>

                <p className="mt-5 max-w-[560px] text-[16px] leading-7 text-muted-foreground sm:text-[17px] animate-in fade-in slide-in-from-bottom-3 duration-700 delay-300 [animation-fill-mode:both]">
                  Loop is the <span className="font-semibold text-foreground">Real Estate NA CRM</span> for NAAR: Project→Tower→Unit, cost sheet in 30s, HOLD→Booking→8 CLP milestones, RERA demand letters, GPS site visits, broker-scoped inventory —{" "}
                  <span className="font-medium text-foreground underline decoration-amber-500/30 decoration-2 underline-offset-4">no Excel, no leakage.</span> Every query by workspaceId, every move logged as Activity.
                </p>
                <div className="mt-3 hidden sm:inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 border border-amber-500/15 animate-in fade-in duration-700 delay-400">
                  <Hammer className="size-3.5" /> Built for Owners, Sales, Brokers, Site Engineers & Accounts — all on one loop
                </div>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-300 border border-violet-500/15 animate-in fade-in duration-700 delay-500">
                  <MousePointer2 className="size-3.5" /> Try dragging a deal — SG Highway → Bopal → loop closed
                  <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-violet-600/70"><Play className="size-3" /> interactive</span>
                </div>

                {/* CTAs — shadcn ecosystem: primary shimmer + secondary outline + kbd */}
                <div className="mt-7 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-700 delay-500 [animation-fill-mode:both]">
                  <Button
                    size="lg"
                    className="group relative overflow-hidden rounded-full gap-2 h-11 px-7 shadow-[0_12px_32px_rgba(0,0,0,0.14)] hover:shadow-[0_16px_44px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 transition-all"
                    render={<Link href={isAuthed ? `/${workspaceSlug}/contacts` : "/signup"} />}>
                    {/* shimmer sweep */}
                    <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700 ease-out" />
                    {isAuthed ? "Open your workspace" : "Start free in 30 seconds"}
                    <span className="flex size-6 items-center justify-center rounded-full bg-background text-foreground group-hover:rotate-45 group-hover:scale-105 transition-transform duration-300">
                      <ArrowUpRight className="size-3.5" />
                    </span>
                  </Button>

                  <Tooltip>
                    <TooltipTrigger
                      render={<Button
                        variant="outline"
                        size="lg"
                        className="rounded-full gap-2 h-11 px-6 bg-card/80 backdrop-blur hover:bg-accent border-border/60"
                        onClick={() => setSearchOpen(true)}
                      >
                        <span className="size-2 rounded-full bg-violet-600 animate-pulse shadow-[0_0_8px_rgba(124,58,237,0.5)]" /> Try <Kbd className="bg-muted">⌘K</Kbd> search
                      </Button>}
                    />
                    <TooltipContent side="bottom" className="max-w-[260px]">
                      <p className="font-medium">Workspace-scoped · &lt;40ms Postgres FTS</p>
                      <p className="text-xs text-muted-foreground">Contacts, deals, orgs, activities — instant & private.</p>
                    </TooltipContent>
                  </Tooltip>

                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-emerald-600" /> No card required
                  </span>
                </div>

                {/* social proof — Ahmedabad builders trust */}
                <div className="mt-8 flex flex-wrap items-center gap-5 border-t border-border/60 pt-6 animate-in fade-in duration-700 delay-700 [animation-fill-mode:both]">
                  <div className="flex -space-x-2">
                    <Avatar className="size-8 border-2 border-background shadow-sm"><AvatarImage src="https://i.pravatar.cc/100?img=33" /><AvatarFallback>S</AvatarFallback></Avatar>
                    <Avatar className="size-8 border-2 border-background shadow-sm"><AvatarImage src="https://i.pravatar.cc/100?img=15" /><AvatarFallback>G</AvatarFallback></Avatar>
                    <Avatar className="size-8 border-2 border-background shadow-sm"><AvatarImage src="https://i.pravatar.cc/100?img=8" /><AvatarFallback>H</AvatarFallback></Avatar>
                    <span className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-[#0B1C3D] font-mono text-[10px] font-medium text-white shadow-sm">+40</span>
                  </div>
                  <div className="text-sm leading-tight">
                    <div className="font-medium tracking-tight flex items-center gap-1.5">Trusted by NAAR Ahmedabad — 40+ sites <Badge variant="secondary" className="rounded-full h-5 px-1.5 font-mono text-[10px] gap-1"><MapPin className="size-3 text-emerald-600" /> SG-BOPAL</Badge></div>
                    <div className="flex items-center gap-1 text-muted-foreground text-xs"><span className="text-amber-500">★★★★★</span> Avg cost sheet 18s · Excel-free since 2025 · gu/hi</div>
                  </div>
                  <Separator orientation="vertical" className="hidden h-9 sm:block" />
                  <div className="hidden sm:flex items-center gap-2.5 font-mono text-[11px] leading-none text-muted-foreground">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 border border-emerald-500/15"><FileCheck className="size-4" /></span>
                    <div>
                      <div className="font-medium text-foreground">RERA · DPDP · Postgres RLS</div>
                      <div>Audit every move · CLP 8 milestones</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT — Live specimen with bento glass effect */}
              <div className="relative lg:pl-2">
                {/* glow behind card */}
                <div className="absolute -inset-5 -z-10 rounded-[36px] bg-gradient-to-br from-violet-500/15 via-blue-500/10 to-cyan-500/10 blur-3xl" />
                <div
                  className="relative overflow-visible rounded-[28px] border bg-card shadow-[0_32px_80px_rgba(0,0,0,0.12),0_10px_28px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out will-change-transform"
                  style={{ transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)` }}
                >
                  {/* border beam — subtle top accent */}
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent opacity-60" />
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
                            <div className="font-mono text-[11px] tracking-widest text-muted-foreground px-2 py-1">WORKSPACES · POPPER</div>
                            {(Object.keys(WORKSPACES) as WsKey[]).map((k) => (
                              <button
                                key={k}
                                onClick={() => switchWs(k)}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors ${k === activeWs ? "bg-accent ring-1 ring-border" : ""}`}
                              >
                                <span className="flex size-7 items-center justify-center rounded-full text-xs text-white shadow-sm" style={{ background: WORKSPACES[k].color }}>{WORKSPACES[k].letter}</span>
                                <span className="font-medium">{WORKSPACES[k].name}</span>
                                <span className="ml-auto font-mono text-[11px] text-muted-foreground">/{WORKSPACES[k].slug}</span>
                                {k === activeWs && <Check className="size-3.5 text-violet-600" />}
                              </button>
                            ))}
                            <Separator className="my-2" />
                            <div className="px-2 py-1 font-mono text-[11px] text-muted-foreground leading-relaxed">Every query scoped by <span className="text-foreground font-medium">workspaceId</span> · try ⌘K after switching.</div>
                            <Button size="sm" variant="outline" className="mt-2 w-full rounded-full gap-1.5" onClick={() => setSearchOpen(true)}><Search className="size-3.5" /> Search in {ws.name}</Button>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Badge variant="secondary" className="hidden sm:inline-flex gap-1 font-mono text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 shadow-sm">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
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
                            className={`rounded-2xl p-2 shadow-sm ring-1 transition-all ${isDrop ? "bg-violet-50 dark:bg-violet-950/30 ring-violet-500 scale-[1.02] shadow-md" : "bg-card ring-border hover:ring-border/80"}`}
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
                                  className={`group cursor-grab rounded-xl border bg-card p-3 shadow-sm transition-all active:cursor-grabbing ${dragId === d.id ? "opacity-40 scale-[0.98] border-primary/30" : "border-border hover:border-violet-200 dark:hover:border-violet-800 hover:shadow-md hover:-translate-y-0.5"}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="text-[13px] font-medium leading-tight tracking-tight">{d.title}</div>
                                    <span className="hidden size-6 place-items-center rounded-full bg-muted text-[10px] group-hover:grid shrink-0"><MousePointer2 className="size-3" /></span>
                                  </div>
                                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">{d.org}</div>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="font-mono text-[11px] font-semibold tracking-tight text-violet-600 dark:text-violet-400">₹{(d.value / 100000).toFixed(1)}L</span>
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
                              {isDrop && <div className="rounded-xl border-2 border-dashed border-violet-500/40 bg-violet-50 dark:bg-violet-950/20 px-3 py-6 text-center font-mono text-[11px] font-medium text-violet-600 dark:text-violet-300">Drop to {col.label} → auto-log</div>}
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
                            <div className="bg-card px-3 py-2.5 font-mono text-violet-600 dark:text-violet-400 text-xs">₹{d.value.toLocaleString("en-IN")}</div>
                            <div className="bg-card px-3 py-2.5">
                              <select value={d.stage} onChange={(e) => moveDeal(d.id, e.target.value as Stage)} className="rounded-full border bg-muted px-2 py-1 font-mono text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20">
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
                    <Badge className="rounded-full font-mono text-[10px] tracking-widest gap-1 shadow-sm"><span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> STAGE CHANGES AUTO-LOGGED</Badge>
                  </div>

                  {/* floating metrics — bento poppers */}
                  <div className="absolute -bottom-5 -left-3 hidden rounded-2xl border bg-card px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.12)] sm:flex items-center gap-3 animate-[float_5s_ease-in-out_infinite] backdrop-blur">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 border border-violet-500/15"><TrendingUp className="size-4" /></span>
                    <div><div className="font-mono text-[11px] tracking-widest text-muted-foreground">PIPELINE VALUE · {ws.name.toUpperCase()}</div><div className="text-[15px] font-semibold tracking-tight">₹{(pipelineValue / 100000).toFixed(1)}L · {deals.length} deals</div></div>
                    <Progress value={Math.min(100, (pipelineValue / 50000000) * 100)} className="hidden lg:block w-16 h-1.5 ml-2" />
                  </div>
                  <div className="absolute -right-2 -top-3 hidden rounded-full border bg-card px-3 py-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] sm:flex items-center gap-2 animate-[float2_6s_ease-in-out_infinite] backdrop-blur">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" /><span className="font-mono text-[11px] font-medium tracking-widest">SYNCED · 12ms</span>
                  </div>
                </div>
                <p className="mx-auto mt-7 max-w-[440px] text-center font-mono text-[11px] leading-relaxed tracking-wide text-muted-foreground">Drag any card between columns — it logs activity, updates timeline and re-indexes search. Hit <Kbd>⌘K</Kbd> or “Move →”.</p>
              </div>
            </div>

            {/* STATS BAR — construction bento, hover spotlight */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[22px] border bg-border shadow-sm lg:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-700">
              {[
                { k: "COST SHEET", v: "18 sec", sub: "base+GST+stamp+others → total", icon: ReceiptText, accent: "text-emerald-600" },
                { k: "HOLD → BOOKING", v: "48 sec", sub: "KYC + 8 CLP milestones auto", icon: Hammer, accent: "text-amber-600" },
                { k: "SITE GPS", v: "200m", sub: "geofence verified check-in", icon: Navigation, accent: "text-blue-600" },
                { k: "RERA DEMAND #1", v: "9 sec", sub: "shortcodes → PDF + e-sign stub", icon: FileCheck, accent: "text-violet-600" },
              ].map((s) => (
                <div key={s.k} className="group relative overflow-hidden bg-card px-6 py-5 hover:bg-muted/40 transition-colors">
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(320px_circle_at_50%_0%,rgba(139,92,246,0.08),transparent_70%)]" />
                  <div className="relative flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground"><s.icon className={`size-3 ${s.accent}`} /> {s.k}</div>
                  <div className="relative mt-1 text-[22px] font-semibold tracking-tight group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{s.v}</div>
                  <div className="relative font-mono text-[11px] text-muted-foreground">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURE BENTO — shadcn Card + HoverCard + Popover + Tooltip spotlight */}
        <section id="product" className="mx-auto max-w-[1280px] px-6 py-14 lg:px-8 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Badge variant="outline" className="rounded-full gap-1.5 font-mono tracking-[0.14em] text-[#0B1C3D] dark:text-violet-300 border-[#0B1C3D]/15 dark:border-violet-800">
                <Hammer className="size-3" /> PRODUCT · BUILT FOR CONSTRUCTION
              </Badge>
              <h2 className="mt-3 text-[30px] font-bold leading-[0.95] tracking-[-0.025em] sm:text-[40px]">
                Excel ends.<br /><span className="font-light italic text-muted-foreground">The loop begins.</span>
              </h2>
            </div>
            <p className="max-w-[440px] text-[14px] leading-6 text-muted-foreground">
              Project→Tower→Floor→Unit, cost sheets, CLP demand letters, broker scope, GPS site visits — not four tools, <span className="font-medium text-foreground">one construction loop</span>. Edit anywhere, RERA anywhere.{" "}
              <button onClick={() => setSearchOpen(true)} className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:text-foreground underline underline-offset-4 font-medium">Try search — gu/hi too <ChevronRight className="size-3" /></button>
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-12 auto-rows-fr">
            {/* Large — contacts with hoverCard bento effect */}
            <HoverCard>
              <HoverCardTrigger render={<Card className="group relative overflow-hidden lg:col-span-7 flex flex-col justify-between hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 cursor-pointer border-border/60 h-full">
                  {/* spotlight + border beam */}
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-[radial-gradient(560px_circle_at_80%_20%,rgba(139,92,246,0.10),transparent_65%)]" />
                  </div>
                  <div className="absolute right-0 top-0 hidden h-[200px] w-[320px] rounded-bl-[28px] bg-muted/60 p-4 sm:block border-l border-b backdrop-blur">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted-foreground"><span>CONTACT</span><span className="h-px flex-1 bg-border" /><span className="text-violet-600">LIVE PREVIEW · {ws.name}</span></div>
                      <div className="rounded-xl border bg-card p-3 shadow-sm">
                        <div className="flex items-center gap-2"><Avatar className="size-7"><AvatarImage src="https://i.pravatar.cc/100?img=22" /><AvatarFallback>AM</AvatarFallback></Avatar><span className="text-sm font-medium">{ws.contacts[0]?.name}</span><Badge variant="secondary" className="ml-auto rounded-full font-mono text-[10px] bg-violet-500/10 text-violet-600 border-violet-500/15">OWNER</Badge></div>
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
                      <li className="flex gap-2"><span className="text-violet-600 font-bold">→</span> Bulk tag · assign owner · export CSV</li>
                      <li className="flex gap-2"><span className="text-violet-600 font-bold">→</span> Command-K everywhere — <button onClick={() => setSearchOpen(true)} className="underline decoration-violet-300 hover:text-foreground">open now</button> <Kbd className="ml-1">⌘K</Kbd></li>
                    </ul>
                    <div className="mt-4 flex gap-2">
                      <Tooltip>
                        <TooltipTrigger render={<Badge variant="secondary" className="rounded-full gap-1 shadow-sm"><Gauge className="size-3" /> avg 12ms</Badge>} />
                        <TooltipContent>HoverCard + Tooltip are shadcn poppers — this whole bento uses the ecosystem.</TooltipContent>
                      </Tooltip>
                      <Badge variant="outline" className="rounded-full font-mono text-[11px]">3 bulk actions</Badge>
                    </div>
                  </CardContent>
                </Card>} />
              <HoverCardContent className="w-80" side="top" align="center">
                <div className="flex gap-3">
                  <div className="size-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600 border border-violet-500/15 shrink-0"><Search className="size-5" /></div>
                  <div>
                    <div className="font-medium text-sm flex items-center gap-1.5">Hover preview <Badge className="rounded-full h-5 text-[10px]">HoverCard</Badge></div>
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed">This card pops on hover via shadcn HoverCard. The live demo above drags & auto-logs — timeline stays in sync.</div>
                    <Button size="sm" className="mt-3 rounded-full h-7 text-xs gap-1 shadow-sm" onClick={() => setSearchOpen(true)}>Open ⌘K <ExternalLink className="size-3" /></Button>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>

            {/* Dark card — organizations with popper */}
            <Card className="group lg:col-span-5 bg-foreground text-background border-foreground overflow-hidden hover:shadow-[0_20px_60px_rgba(0,0,0,0.22)] hover:-translate-y-1 transition-all duration-300 relative h-full flex flex-col">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_100%_0%,rgba(124,58,237,0.22),transparent_60%)] opacity-60" />
              <CardHeader className="relative">
                <div className="inline-flex size-9 items-center justify-center rounded-xl bg-background text-foreground shadow-sm"><Building2 className="size-4" /></div>
                <CardTitle className="text-background tracking-tight">Organizations that link themselves</CardTitle>
                <CardDescription className="text-background/60 leading-relaxed">Company profiles with linked contacts & deals. Loop suggests links by email domain — you confirm with one click.</CardDescription>
              </CardHeader>
              <CardContent className="relative flex-1 flex flex-col justify-end">
                <div className="rounded-xl bg-background/10 p-3.5 backdrop-blur border border-background/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="flex items-center justify-between font-mono text-[11px] tracking-widest text-background/60"><span>DOMAIN MATCH</span><span className="text-background font-medium">{activeWs === "acme" ? "94%" : activeWs === "vela" ? "88%" : "76%"} · AUTO-SUGGEST</span></div>
                  <Progress value={activeWs === "acme" ? 94 : activeWs === "vela" ? 88 : 76} className="mt-2 h-1.5 bg-background/10 [&>div]:bg-emerald-400" />
                  <div className="mt-2.5 flex items-center gap-2 text-sm text-background font-medium"><span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]" /> {activeWs === "acme" ? "atlassian.com → 8 contacts · 3 deals" : activeWs === "vela" ? "helios.inc → 5 contacts · 2 deals" : "lumen.co → 3 contacts"}</div>
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
            <Card className="group lg:col-span-5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 border-border/60 overflow-hidden relative h-full">
              <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(420px_circle_at_0%_0%,rgba(139,92,246,0.08),transparent_62%)]" />
              <CardHeader className="relative">
                <div className="inline-flex size-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 border border-violet-500/15 group-hover:bg-violet-600 group-hover:text-white group-hover:border-violet-600 transition-colors"><Layers className="size-4" /></div>
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
            <Card className="group lg:col-span-4 hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 border-border/60 relative overflow-hidden h-full flex flex-col">
              <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(380px_circle_at_100%_100%,rgba(239,68,68,0.06),transparent_60%)]" />
              <CardHeader className="relative">
                <div className="inline-flex size-9 items-center justify-center rounded-xl bg-red-500/10 text-red-600 border border-red-500/15"><Zap className="size-4" /></div>
                <CardTitle className="text-[16px] tracking-tight">Activities that stay attached</CardTitle>
                <CardDescription className="leading-relaxed">Notes, emails, calls, meetings, tasks — on every record. “My Tasks” aggregates what&apos;s yours. <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border">source: manual | agent</span></CardDescription>
              </CardHeader>
              <CardContent className="relative flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="rounded-full gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 shadow-sm"><Activity className="size-3" /> {activities.length} today</Badge>
                  <Badge variant="outline" className="rounded-full font-mono text-[10px]">{ws.contacts.length} contacts</Badge>
                  <Popover>
                    <PopoverTrigger render={<Button variant="outline" size="sm" className="ml-auto h-6 rounded-full text-[11px] gap-1 shadow-sm">Details <ChevronRight className="size-3" /></Button>} />
                    <PopoverContent align="end" className="w-72">
                      <div className="font-medium text-sm flex items-center gap-1.5"><Zap className="size-4 text-red-500" /> Activity popper</div>
                      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">shadcn Popover — shows how activities are scoped to workspace and auto-logged on stage change. Try dragging a card.</div>
                      <Separator className="my-3" />
                      <div className="flex gap-1.5 flex-wrap">
                        {activities.slice(0,3).map(a => (
                          <Badge key={a.id} variant="secondary" className="font-mono text-[10px] rounded-full">{a.title}</Badge>
                        ))}
                      </div>
                      <Button size="sm" className="mt-3 w-full rounded-full gap-1" onClick={() => { const id=Math.random().toString(36).slice(2,6); setActivities(a=>[{ id, kind:"note", title:"Note added", detail:`“Loop demo note ${id}” — You · just now`, time:"now"}, ...a.slice(0,4)]); setToast("Note added → timeline"); setTimeout(()=>setToast(null),1500)}}><Plus className="size-3" /> Add demo note</Button>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-mono text-muted-foreground"><div className="size-2 rounded-full bg-emerald-500 animate-pulse" /> live · auto-log on drop</div>
              </CardContent>
            </Card>

            {/* Search bento — gradient + button popper */}
            <Card className="group lg:col-span-3 bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50 dark:from-violet-950/35 dark:via-blue-950/20 dark:to-cyan-950/15 border-violet-200/60 dark:border-violet-800/30 hover:shadow-[0_16px_40px_rgba(124,58,237,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden h-full flex flex-col">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(380px_circle_at_90%_10%,rgba(139,92,246,0.14),transparent_60%)]" />
              <CardHeader className="relative">
                <div className="font-mono text-[11px] tracking-[0.14em] text-violet-600 flex items-center gap-1.5 font-semibold"><CommandIcon className="size-3" /> SEARCH</div>
                <CardTitle className="text-[18px] leading-tight tracking-tight">Workspace-scoped, instant</CardTitle>
                <CardDescription className="text-[13px] leading-5">Postgres full-text across contacts, deals, orgs, activities. Scoped to your workspace — fast and private.</CardDescription>
              </CardHeader>
              <CardContent className="relative flex-1 flex flex-col justify-end">
                <Button variant="outline" className="w-full justify-start gap-2 rounded-full bg-card shadow-sm hover:shadow-md hover:border-violet-300 dark:hover:border-violet-700 group/btn border-violet-200/40" onClick={() => setSearchOpen(true)}>
                  <span className="rounded-md bg-foreground px-1.5 py-0.5 font-mono text-[10px] text-background shadow-sm group-hover/btn:bg-violet-600 group-hover/btn:text-white transition-colors">⌘K</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span className="font-mono text-xs text-muted-foreground">Search {ws.name}…</span>
                  <Search className="ml-auto size-3.5 text-muted-foreground group-hover/btn:text-violet-600 transition-colors" />
                </Button>
                <div className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> {filteredSearch.deals.length + filteredSearch.contacts.length} indexed</div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* STAFF — for Ahmedabad construction teams, every role on loop */}
        <section id="staff" className="border-y bg-muted/20">
          <div className="mx-auto max-w-[1280px] px-6 py-12 lg:px-8 lg:py-16">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <Badge variant="outline" className="rounded-full gap-1.5 font-mono tracking-[0.12em] border-[#0B1C3D]/15 text-[#0B1C3D]"><Users className="size-3" /> STAFF · ONE LOOP, EVERY ROLE</Badge>
                <h2 className="mt-3 text-[30px] font-bold leading-[0.95] tracking-[-0.025em] sm:text-[38px]">Built for how Ahmedabad builds.</h2>
                <p className="mt-3 max-w-[560px] text-[14px] leading-6 text-muted-foreground">Owner sees collections, Sales drags HOLD→Booking, Brokers see only their allocation, Site verifies GPS, Accounts sends RERA demand + UPI — same workspace, same audit, 5 voices, one loop. Gujarati + Hindi where it counts.</p>
              </div>
              <Badge variant="secondary" className="rounded-full gap-1.5 font-mono text-[11px]"><Hammer className="size-3" /> 5 ROLES · NAAR-TESTED</Badge>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {[
                { role: "Owner / Director", icon: Building2, color: "bg-[#0B1C3D] text-white", kpi: "₹2.4Cr weighted", desc: "Funnel, inventory health, collections, team vs target — Excel-free." },
                { role: "Sales Manager", icon: Phone, color: "bg-violet-600 text-white", kpi: "HOLD→Booking 48s", desc: "Drag kanban, auto-log Activity, cost sheet 18s, WhatsApp ack." },
                { role: "Broker / CP", icon: Handshake, color: "bg-amber-600 text-white", kpi: "Scoped % allocation", desc: "Sees only allocated units, commission auto-calc, referral ledger." },
                { role: "Site Engineer", icon: Navigation, color: "bg-emerald-600 text-white", kpi: "200m GPS", desc: "Schedule visit, check-in verified, offline PWA on field." },
                { role: "Accounts", icon: ReceiptText, color: "bg-blue-600 text-white", kpi: "Demand 9s", desc: "CLP 8 milestones, RERA {{rera_no}}, UPI link → receipt, Tally CSV." },
              ].map((r) => (
                <Card key={r.role} className="group hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-foreground via-foreground/60 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="pb-2">
                    <span className={`inline-flex size-8 items-center justify-center rounded-lg text-xs ${r.color} shadow-sm`}><r.icon className="size-4" /></span>
                    <CardTitle className="text-[13px] leading-tight tracking-tight">{r.role}</CardTitle>
                    <Badge variant="secondary" className="w-fit rounded-full font-mono text-[11px]">{r.kpi}</Badge>
                  </CardHeader>
                  <CardContent><p className="text-xs leading-5 text-muted-foreground">{r.desc}</p></CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground"><span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1"><MapPin className="size-3" /> SG Highway · Bopal · South Bopal · Thaltej</span><span>·</span><span>gu/hi templates</span><span>·</span><span>Slug-routed · workspaceId on every query</span></div>
          </div>
        </section>

        {/* WORKFLOW — stepped bento */}
        <section id="workflow" className="border-y bg-card">
          <div className="mx-auto max-w-[1280px] px-6 py-12 lg:px-8 lg:py-16">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="text-[28px] font-bold tracking-[-0.02em] sm:text-[32px]">How the loop runs</h2>
              <Badge variant="outline" className="rounded-full font-mono text-[11px] tracking-[0.12em] gap-1.5 border-violet-200"><Clock3 className="size-3" /> THREE MOVES · REPEAT FOREVER · TRY IT ABOVE</Badge>
            </div>
            <div className="relative mt-10 grid gap-6 lg:grid-cols-3">
              <div aria-hidden className="absolute left-6 right-6 top-[44px] hidden h-px bg-border lg:block"><div className="absolute inset-y-0 left-0 w-1/3 bg-violet-600" /></div>
              {[
                { label: "CAPTURE", title: "Everything lands in one place", desc: "Contacts, orgs, and deals flow in. Tags, owners, and domains auto-link.", icon: Users, accent: "bg-foreground text-background" },
                { label: "MOVE", title: "Drag. It logs itself.", desc: "Move a deal — stage change becomes activity, timeline updates, search re-indexes.", icon: Layers, accent: "bg-violet-600 text-white shadow-[0_8px_24px_rgba(124,58,237,0.3)]" },
                { label: "CLOSE", title: "Activity → revenue, visibly", desc: "Every note and call stays attached. Your “My Tasks” is always current.", icon: Zap, accent: "bg-red-500 text-white shadow-[0_8px_24px_rgba(239,68,68,0.25)]" },
              ].map((s) => (
                <Card key={s.label} className="group relative hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] hover:border-violet-200 dark:hover:border-violet-800 transition-all hover:-translate-y-1 overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(360px_circle_at_50%_0%,rgba(139,92,246,0.06),transparent_70%)]" />
                  <CardHeader className="relative">
                    <div className={`inline-flex size-10 items-center justify-center rounded-xl text-sm ${s.accent} transition-transform group-hover:scale-105`}><s.icon className="size-4" /></div>
                    <div className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground">{s.label}</div>
                    <CardTitle className="text-[18px] leading-tight tracking-tight">{s.title}</CardTitle>
                    <CardDescription className="leading-relaxed">{s.desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>

            <Card className="mt-10 overflow-hidden border-foreground/10 bg-foreground text-background shadow-[0_24px_64px_rgba(0,0,0,0.18)]">
              <CardContent className="p-6 lg:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3"><span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)] animate-pulse" /><span className="font-mono text-[11px] tracking-[0.16em] text-background/60">LIVE WORKSPACE · {ws.name.toUpperCase()}</span><Separator orientation="vertical" className="hidden h-4 bg-background/15 sm:block" /><button onClick={() => setSearchOpen(true)} className="hidden font-mono text-[11px] text-background/50 hover:text-background sm:inline transition-colors">⌘K → “{searchQuery || "northstar"}” · {filteredSearch.deals.length} results in 31ms →</button></div>
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
                      <Button variant="outline" className="w-full rounded-xl border-dashed font-mono text-xs hover:bg-muted" onClick={() => { const id=Math.random().toString(36).slice(2,6); setActivities(a=>[{ id, kind:"note", title:"Note added", detail:`“Loop demo note ${id}” — You · just now`, time:"now"}, ...a.slice(0,4)]); setToast("Note added → timeline"); setTimeout(()=>setToast(null),1500)}}><Plus className="size-3" /> Add note to {ws.name}</Button>
                    </CardContent>
                  </Card>
                  <div className="grid gap-3">
                    <Card className="border-background/10 bg-background/5 backdrop-blur text-background">
                      <CardHeader className="pb-2">
                        <div className="font-mono text-[11px] tracking-[0.16em] text-background/50">WORKSPACE SWITCHER · POPPER</div>
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
                                <span>{WORKSPACES[k].name}</span><span className="ml-auto font-mono text-[11px] text-muted-foreground">/{WORKSPACES[k].slug}</span>{k===activeWs && <Check className="size-4 text-violet-600" />}
                              </button>
                            ))}
                            <Separator className="my-2" />
                            <div className="font-mono text-[11px] text-muted-foreground leading-relaxed">All data re-scopes. Search index rebuilds in &lt;40ms.</div>
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
                    <Card className="bg-violet-600 text-white border-violet-600 shadow-[0_12px_32px_rgba(124,58,237,0.3)]">
                      <CardHeader className="pb-2">
                        <div className="font-mono text-[11px] tracking-[0.14em] text-white/70 inline-flex items-center gap-1.5"><ShieldCheck className="size-3" /> PERMISSIONS · RBAC</div>
                        <CardDescription className="text-white/85 text-sm leading-5">Every server action checks <Kbd className="bg-background/15 text-white border-white/20 shadow-sm">workspaceId</Kbd> and role — Owner / Admin / Member.</CardDescription>
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
            <Badge variant="outline" className="rounded-full font-mono tracking-[0.14em] text-[#0B1C3D] border-[#0B1C3D]/15 gap-1.5"><Building2 className="size-3" /> PRICING · FOR AHMEDABAD BUILDERS</Badge>
            <h2 className="mt-3 text-[32px] font-bold leading-[0.95] tracking-[-0.025em] sm:text-[40px]">Priced for site, not seat tricks.</h2>
            <p className="mx-auto mt-3 max-w-[580px] text-[14px] leading-6 text-muted-foreground">All plans include RERA shortcodes, CLP demand letters, GPS site visits, broker scope, WhatsApp gu/hi, and association pool. RERA export anytime — your data, your possession letter.</p>
          </div>
          <div className="mt-10 grid items-start gap-4 overflow-visible pt-4 pb-3 lg:grid-cols-3">
            {[
              { name: "Builder", price: "₹1,499", note: "per month · 1 project", receipt: "One site, from enquiry to possession", features: ["1 workspace · 1 project", "Unlimited contacts & deals", "Cost sheet 30s + RERA docs", "GPS + WhatsApp inbox"], cta: "Start Builder", featured: false },
              { name: "Team", price: "₹3,999", note: "per month · up to 6 staff", receipt: "Sales + Accounts + Site — same loop", features: ["3 workspaces · Owners + Sales + Brokers", "Roles: Owner/Admin/Sales/Broker/Viewer", "Invite + brokerScopeFilter + CLP", "NAAR pool trial · gu/hi"], cta: "Start Team — NAAR trial", featured: true },
              { name: "Network", price: "₹7,999", note: "per month · up to 12 staff · multi-site", receipt: "For 2–10 projects without Excel", features: ["Unlimited projects + Buyer portal", "Public sites + enquiry→scored lead", "UPI collection + Tally/PDF export", "Association exchange + referral ledger"], cta: "Set up Network", featured: false },
            ].map((p) => (
              <Card key={p.name} className={`group relative min-w-0 overflow-visible flex flex-col transition-all duration-300 ${p.featured ? "border-violet-600 bg-foreground text-background shadow-[0_24px_64px_rgba(0,0,0,0.22)] lg:-translate-y-2 hover:shadow-[0_32px_80px_rgba(0,0,0,0.28)] hover:-translate-y-3" : "hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1 border-border/60"}`}>
                {p.featured && <Badge className="absolute -top-3 left-6 rounded-full bg-violet-600 font-mono text-[11px] tracking-[0.14em] shadow-[0_8px_24px_rgba(124,58,237,0.35)] px-3 py-1">MOST CHOSEN</Badge>}
                {p.featured && <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(600px_circle_at_50%_0%,rgba(124,58,237,0.15),transparent_70%)]" />}
                <CardHeader className="relative">
                  <div className={`font-mono text-[11px] tracking-[0.16em] ${p.featured ? "text-background/60" : "text-muted-foreground"}`}>{p.name.toUpperCase()}</div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1"><span className="text-[36px] font-bold leading-none tracking-tight">{p.price}</span><span className={`min-w-0 font-mono text-[11px] ${p.featured ? "text-background/60" : "text-muted-foreground"}`}>{p.note}</span></div>
                  <div className={`mt-3 border-l-2 pl-3 text-[12px] leading-5 ${p.featured ? "border-violet-400 text-background/70" : "border-violet-300 text-muted-foreground"}`}>{p.receipt}</div>
                </CardHeader>
                <CardContent className="flex-1 relative">
                  <ul className={`space-y-2.5 text-[13px] ${p.featured ? "text-background/80" : "text-muted-foreground"}`}>{p.features.map((f) => (<li key={f} className="flex gap-2.5 items-center"><span className={`flex size-5 items-center justify-center rounded-full shrink-0 ${p.featured ? "bg-background text-foreground" : "bg-violet-500/10 text-violet-600 border border-violet-500/15"}`}><Check className="size-3" /></span> {f}</li>))}</ul>
                </CardContent>
                <div className="p-6 pt-0 space-y-3 relative">
                  <Button className={`w-full rounded-full gap-1.5 shadow-sm group-hover:shadow-md transition-shadow ${p.featured ? "bg-background text-foreground hover:bg-background/90" : ""}`} render={<Link href={isAuthed ? `/${workspaceSlug}/contacts` : "/signup"} />}>{p.cta} <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" /></Button>
                  <div className={`text-center font-mono text-[11px] ${p.featured ? "text-background/50" : "text-muted-foreground"}`}>14-day free · cancel anytime</div>
                </div>
              </Card>
            ))}
          </div>
          <Card className="mt-8 overflow-hidden border-violet-200/70 bg-gradient-to-r from-violet-50 via-card to-cyan-50 shadow-sm dark:from-violet-950/30 dark:via-card dark:to-cyan-950/20">
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
                <Badge variant="outline" className="rounded-full font-mono tracking-[0.14em] text-[#0B1C3D] border-[#0B1C3D]/15 gap-1.5"><Building2 className="size-3" /> MANIFESTO · AHMEDABAD BUILDS, LOOP RUNS</Badge>
                <h2 className="mt-3 text-[28px] font-bold leading-[0.95] tracking-[-0.02em]">Possession isn&apos;t luck.<br />It&apos;s a loop that closes.</h2>
                <p className="mt-4 max-w-[460px] text-[14px] leading-6 text-muted-foreground">We verticalized Loop CRM for NAAR: Shilp Infra to Gala Builders, 2–10 sites, SG Highway to South Bopal. Same workspace for Owners, Sales, Brokers, Site, Accounts — gu/hi where the buyer reads it, RERA where the auditor needs it.</p>
                <div className="mt-6 flex gap-3">
                  <Button className="rounded-full gap-1.5 shadow-sm" render={<Link href={isAuthed ? `/${workspaceSlug}/contacts` : "/signup"} />}>Enter Loop — NAAR demo <ArrowRight className="size-4" /></Button>
                  <Button variant="outline" className="rounded-full bg-card" render={<Link href="/login" />}>See Shilp demo (/acme)</Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { q: "“Cost sheet in 18s, demand letter while the family is still at the site. That was Excel never.”", a: "— Hemal Shah, Shilp Infra, Director — 3 sites SG Highway" },
                  { q: "“GPS check-in killed fake visits. Our Site Engineers actually check in now.”", a: "— Nirav Doshi, Safal Corp, Site — 200m verified" },
                  { q: "“Brokers see only their allocation now. No more ‘who showed that unit?’ fights.”", a: "— Riya Desai, Gala Builders, CP Lead — NAAR exchange" },
                  { q: "“UPI link in the demand WhatsApp — collections before the 7th, Tally-ready.”", a: "— Accounts, Shilp Infra — CLP 8 milestones" },
                ].map((t) => (
                  <Card key={t.q} className="group hover:shadow-md hover:-translate-y-0.5 transition-all border-border/60 overflow-hidden relative">
                    <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(300px_circle_at_0%_0%,rgba(139,92,246,0.06),transparent_70%)]" />
                    <CardContent className="p-5 relative">
                      <div className="text-[15px] font-medium leading-snug tracking-tight">{t.q}</div>
                      <div className="mt-2 font-mono text-[11px] text-muted-foreground flex items-center gap-1"><Star className="size-3 fill-amber-500 text-amber-500" /> {t.a}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="bg-foreground text-background">
          <div className="mx-auto max-w-[1280px] px-6 py-10 lg:px-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-lg bg-background text-foreground shadow-sm"><Layers className="size-4" /></span><span className="text-[13px] font-semibold tracking-[0.18em]">LOOP</span><span className="text-[13px] font-light tracking-[0.12em] text-background/50">CRM</span><Badge variant="secondary" className="ml-2 rounded-full font-mono text-[10px] bg-background/10 text-background border-background/10">© 2026</Badge></div>
                <p className="mt-3 max-w-[360px] text-[13px] leading-6 text-background/60">Multi-tenant CRM for solo founders, freelancers, and small sales teams. Phase 1 live. <Kbd className="bg-background/10 text-background border-background/20">⌘K</Kbd> anywhere — try the interactive demo above.</p>
                <div className="mt-4 flex gap-2 font-mono text-[11px] tracking-wide text-background/40"><span>© 2026 Loop</span><span>·</span><a href="#" className="hover:text-background transition-colors">Privacy</a><span>·</span><a href="#" className="hover:text-background transition-colors">Terms</a><span>·</span><a href="#" className="hover:text-background transition-colors">Contact</a></div>
              </div>
              <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
                <div><div className="font-mono text-[11px] tracking-[0.16em] text-background/40">PRODUCT</div><ul className="mt-3 space-y-2 text-background/70"><li><a href="#product" className="hover:text-background transition-colors">Features</a></li><li><a href="#workflow" className="hover:text-background transition-colors">Workflow</a></li><li><a href="#pricing" className="hover:text-background transition-colors">Pricing</a></li><li><Link href="/login" className="hover:text-background transition-colors">Demo login</Link></li></ul></div>
                <div><div className="font-mono text-[11px] tracking-[0.16em] text-background/40">CRAFT</div><ul className="mt-3 space-y-2 text-background/70"><li><span>Next.js 16 · Prisma 7</span></li><li><span>Postgres · NextAuth v5</span></li><li><span>shadcn/ui · Tailwind v4</span></li><li><span>Vercel-ready</span></li></ul></div>
                <div className="col-span-2 sm:col-span-1"><div className="font-mono text-[11px] tracking-[0.16em] text-background/40">START</div><Card className="mt-3 bg-background text-foreground shadow-sm"><CardContent className="p-3"><div className="text-sm font-medium">demo@loopcrm.com</div><div className="font-mono text-[12px] text-muted-foreground">password123 · workspace /acme</div><Button size="sm" className="mt-3 w-full rounded-full gap-1.5" render={<Link href={isAuthed ? `/${workspaceSlug}/contacts` : "/signup"} />}>Get started <ArrowRight className="size-3.5" /></Button></CardContent></Card></div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  )
}
