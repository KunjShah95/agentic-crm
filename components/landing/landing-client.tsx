"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import Link from "next/link"

// ——— MOCK DATA ———
type Stage = "lead" | "qualified" | "closing"
type Deal = { id: string; title: string; value: number; owner: string; stage: Stage; org: string }
type Activity = { id: string; kind: "stage" | "call" | "task" | "note"; title: string; detail: string; time: string }

const WORKSPACES = {
  acme: {
    name: "Acme",
    slug: "acme",
    letter: "A",
    color: "#0A0E1E",
    pipelineBase: 412000,
    deals: [
      { id: "1", title: "Northstar — Seed", value: 42000, owner: "AE", stage: "lead" as Stage, org: "Northstar Labs" },
      { id: "2", title: "Atlas Design →", value: 86000, owner: "MJ", stage: "qualified" as Stage, org: "Atlas Design" },
      { id: "3", title: "Vela Systems", value: 128000, owner: "MJ", stage: "closing" as Stage, org: "Vela Systems" },
      { id: "4", title: "Bloom & Co", value: 31000, owner: "PR", stage: "lead" as Stage, org: "Bloom & Co" },
      { id: "5", title: "Orbit Finance", value: 74000, owner: "AE", stage: "qualified" as Stage, org: "Orbit" },
    ] as Deal[],
    activities: [
      { id: "a1", kind: "stage", title: "Stage → Qualified", detail: "Atlas moved by Maya · 2h ago", time: "2h" },
      { id: "a2", kind: "call", title: "Call logged", detail: "Intro call — 24 min · notes attached", time: "4h" },
      { id: "a3", kind: "task", title: "Task · Follow up deck", detail: "Due tomorrow · assigned to you", time: "6h" },
    ] as Activity[],
    contacts: [
      { name: "Amelia Chen", org: "Northstar Labs", tag: "enterprise" },
      { name: "Jonas Park", org: "Atlas Design", tag: "warm" },
      { name: "Maya R.", org: "Vela Systems", tag: "q4" },
    ],
  },
  vela: {
    name: "Vela Systems",
    slug: "vela",
    letter: "V",
    color: "#2D4BFF",
    pipelineBase: 298000,
    deals: [
      { id: "6", title: "Helios — Series A", value: 210000, owner: "AE", stage: "closing" as Stage, org: "Helios" },
      { id: "7", title: "Draft Labs", value: 18000, owner: "PR", stage: "lead" as Stage, org: "Draft Labs" },
      { id: "8", title: "Northwind", value: 54000, owner: "MJ", stage: "qualified" as Stage, org: "Northwind" },
      { id: "9", title: "Cedar Health", value: 67000, owner: "AE", stage: "lead" as Stage, org: "Cedar" },
    ] as Deal[],
    activities: [
      { id: "b1", kind: "stage", title: "Stage → Closing", detail: "Helios moved by Alex · 30m ago", time: "30m" },
      { id: "b2", kind: "note", title: "Note added", detail: "“Loves the loop metaphor” — Priya", time: "1h" },
      { id: "b3", kind: "task", title: "Task · Send MSA", detail: "Due today · assigned to Priya", time: "3h" },
    ] as Activity[],
    contacts: [
      { name: "Priya Desai", org: "Helios", tag: "enterprise" },
      { name: "Leo Grant", org: "Draft Labs", tag: "warm" },
      { name: "Samir K.", org: "Cedar Health", tag: "q4" },
    ],
  },
  solana: {
    name: "Solana Studio",
    slug: "solana",
    letter: "S",
    color: "#FF2E1F",
    pipelineBase: 156000,
    deals: [
      { id: "10", title: "Lumen — Brand", value: 26000, owner: "PR", stage: "lead" as Stage, org: "Lumen" },
      { id: "11", title: "Folk Coffee", value: 12000, owner: "MJ", stage: "lead" as Stage, org: "Folk" },
      { id: "12", title: "Harbor & Sons", value: 94000, owner: "AE", stage: "qualified" as Stage, org: "Harbor" },
    ] as Deal[],
    activities: [
      { id: "c1", kind: "call", title: "Call logged", detail: "Discovery — 18 min · Lumen", time: "1h" },
      { id: "c2", kind: "stage", title: "Stage → Qualified", detail: "Harbor moved by You · just now", time: "now" },
    ] as Activity[],
    contacts: [{ name: "Rae Hollis", org: "Lumen", tag: "warm" }],
  },
} as const

type WsKey = keyof typeof WORKSPACES

type Props = { workspaceSlug?: string | null; isAuthed: boolean }

export function LandingClient({ workspaceSlug, isAuthed }: Props) {
  const [activeWs, setActiveWs] = useState<WsKey>("acme")
  const [deals, setDeals] = useState<Deal[]>(WORKSPACES.acme.deals)
  const [activities, setActivities] = useState<Activity[]>(WORKSPACES.acme.activities)
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
  const ws = WORKSPACES[activeWs]

  // switch workspace — updates deals + activities with a flash
  const switchWs = (key: WsKey) => {
    setActiveWs(key)
    setDeals(WORKSPACES[key].deals)
    setActivities(WORKSPACES[key].activities)
    setShowWsMenu(false)
    setShowWsMenuDark(false)
    setToast(`Switched to ${WORKSPACES[key].name} · /${WORKSPACES[key].slug}`)
    setTimeout(() => setToast(null), 2400)
  }

  // parallax
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      setParallax({ x: (e.clientX - cx) / 50, y: (e.clientY - cy) / 60 })
    }
    const m = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (m.matches) return
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  // keyboard: cmd+k
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

  // move deal to next stage (click or drop)
  const moveDeal = (id: string, to: Stage) => {
    setDeals((prev) => {
      const deal = prev.find((d) => d.id === id)
      if (!deal || deal.stage === to) return prev
      const from = deal.stage
      const next = prev.map((d) => (d.id === id ? { ...d, stage: to } : d))
      // log activity
      const title = `Stage ${from} → ${to}`
      const entry: Activity = {
        id: Math.random().toString(36).slice(2, 7),
        kind: "stage",
        title,
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

  const stageCols: { key: Stage; label: string }[] = [
    { key: "lead", label: "Lead" },
    { key: "qualified", label: "Qualified" },
    { key: "closing", label: "Closing" },
  ]

  return (
    <div className="bg-[#FCFCFA] text-[#0E1220] selection:bg-[#2D4BFF] selection:text-white">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap');`}</style>

      {/* toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-[#E9EAF2] bg-[#0A0E1E] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
          {toast}
        </div>
      )}

      {/* command palette */}
      {searchOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[#0A0E1E]/40 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[640px] overflow-hidden rounded-[20px] border border-[#E9EAF2] bg-white shadow-[0_24px_64px_rgba(12,18,36,0.22)]"
          >
            <div className="flex items-center gap-3 border-b border-[#EEF0F6] px-4 py-3">
              <span className="rounded-md bg-[#0A0E1E] px-1.5 py-1 font-mono text-[11px] tracking-widest text-white">⌘K</span>
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${ws.name} — try “Atlas”, “Helios”, or “call”`}
                className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#8A90A8]"
              />
              <button onClick={() => setSearchOpen(false)} className="rounded-full border border-[#E9EAF2] px-3 py-1 text-xs">ESC</button>
            </div>
            <div className="max-h-[420px] overflow-auto p-2">
              <div className="px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[#8A90A8]">DEALS · {filteredSearch.deals.length}</div>
              {filteredSearch.deals.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setSearchOpen(false)
                    setToast(`Opened ${d.title}`)
                    setTimeout(() => setToast(null), 1500)
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-[#F6F7FB]"
                >
                  <span className="text-sm font-medium">{d.title}</span>
                  <span className="font-mono text-xs text-[#2D4BFF]">${(d.value / 1000).toFixed(0)}k · {d.stage}</span>
                </button>
              ))}
              <div className="mt-2 px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-[#8A90A8]">CONTACTS · {filteredSearch.contacts.length}</div>
              {filteredSearch.contacts.map((c) => (
                <div key={c.name} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-[#F6F7FB]">
                  <span className="text-sm">{c.name} <span className="text-[#8A90A8]">· {c.org}</span></span>
                  <span className="rounded-full bg-[#F3F4F8] px-2 py-0.5 font-mono text-[10px]">#{c.tag}</span>
                </div>
              ))}
              {!filteredSearch.deals.length && !filteredSearch.contacts.length && (
                <div className="px-3 py-8 text-center text-sm text-[#8A90A8]">No results for “{searchQuery}” in {ws.name}</div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-[#EEF0F6] bg-[#FBFBFA] px-4 py-2.5 font-mono text-[11px] text-[#8A90A8]">
              <span>↩ open · ↑↓ navigate · workspace-scoped · &lt;40ms</span>
              <span className="rounded-full bg-white px-2 py-1 ring-1 ring-[#E9EAF2]">/{activeWs}</span>
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-[#E9EAF2] bg-[#FCFCFA]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[64px] w-full max-w-[1280px] items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-[9px] bg-[#0A0E1E] text-white"><span className="text-[16px] leading-none">◐</span></span>
              <span className="text-[13px] font-semibold tracking-[0.18em]">LOOP</span>
              <span className="hidden text-[13px] font-light tracking-[0.12em] text-[#6E7488] sm:inline">CRM</span>
              <span className="ml-1 hidden rounded-full border border-[#E9EAF2] bg-white px-2 py-0.5 text-[10px] font-medium tracking-widest text-[#6E7488] lg:inline">PHASE 1 — LIVE</span>
            </Link>
            <nav className="hidden items-center gap-6 text-[13px] font-medium tracking-tight md:flex">
              <a href="#product" className="text-[#5A6075] hover:text-[#0E1220] transition-colors">Product</a>
              <a href="#workflow" className="text-[#5A6075] hover:text-[#0E1220] transition-colors">Workflow</a>
              <a href="#pricing" className="text-[#5A6075] hover:text-[#0E1220] transition-colors">Pricing</a>
              <a href="#manifesto" className="text-[#5A6075] hover:text-[#0E1220] transition-colors">Manifesto</a>
            </nav>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <button onClick={() => setSearchOpen(true)} className="hidden items-center gap-2 rounded-full border border-[#E9EAF2] bg-white px-3 py-2 text-xs font-medium text-[#5A6075] hover:bg-[#F3F4F8] lg:inline-flex">
              <span className="rounded bg-[#0A0E1E] px-1 py-0.5 font-mono text-[10px] text-white">⌘K</span> Search
            </button>
            {!isAuthed ? (
              <>
                <Link href="/login" className="rounded-full px-4 py-2 text-[13px] font-medium text-[#0E1220] hover:bg-[#EEF0F6] transition-colors">Sign in</Link>
                <Link href="/signup" className="rounded-full bg-[#0A0E1E] px-5 py-2.5 text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(10,14,30,0.18)] hover:bg-black transition-colors">Start free — 14 days</Link>
              </>
            ) : (
              <Link href={`/${workspaceSlug}/contacts`} className="rounded-full bg-[#2D4BFF] px-5 py-2.5 text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(45,75,255,0.35)] hover:bg-[#2440e6] transition-colors">Go to workspace →</Link>
            )}
          </div>
          <button aria-label="Toggle menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)} className="inline-flex size-9 items-center justify-center rounded-full border border-[#E9EAF2] bg-white md:hidden">
            <span className="text-sm">{mobileOpen ? "✕" : "≡"}</span>
          </button>
        </div>
        <div className="relative h-px w-full overflow-hidden bg-[#E9EAF2]">
          <div className="absolute inset-y-0 left-0 w-[35%] bg-gradient-to-r from-[#2D4BFF] to-transparent opacity-60" />
          <div className="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-[#FF2E1F] shadow-[0_0_12px_rgba(255,46,31,0.6)]" style={{ animation: "loopRun 7s linear infinite" }} />
        </div>
        {mobileOpen && (
          <div className="border-t border-[#E9EAF2] bg-white px-6 py-6 md:hidden">
            <nav className="flex flex-col gap-4 text-sm font-medium">
              <a href="#product" onClick={() => setMobileOpen(false)}>Product</a>
              <a href="#workflow" onClick={() => setMobileOpen(false)}>Workflow</a>
              <a href="#pricing" onClick={() => setMobileOpen(false)}>Pricing</a>
              <button onClick={() => setSearchOpen(true)} className="rounded-full border border-[#E9EAF2] py-2.5">⌘K Search</button>
              <Link href={isAuthed ? `/${workspaceSlug}/contacts` : "/signup"} className="mt-2 rounded-full bg-[#0A0E1E] py-3 text-center text-white">{isAuthed ? "Open workspace" : "Start free"}</Link>
            </nav>
          </div>
        )}
      </header>

      {/* HERO */}
      <section ref={heroRef} className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(to right, #E9EAF2 1px, transparent 1px), linear-gradient(to bottom, #E9EAF2 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            maskImage: "radial-gradient(ellipse 85% 70% at 50% 0%, black 60%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 85% 70% at 50% 0%, black 60%, transparent 75%)",
            opacity: 0.35,
          }}
        />
        <div className="relative mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="grid gap-10 pb-10 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pb-16 lg:pt-14">
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E9EAF2] bg-white px-3 py-1.5 shadow-sm">
                <span className="size-1.5 rounded-full bg-[#FF2E1F] animate-pulse" />
                <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-[#5A6075]">FOR SOLO FOUNDERS · FREELANCERS · SMALL TEAMS</span>
              </div>
              <h1 className="mt-6 font-[Instrument_Serif] text-[42px] font-normal leading-[0.95] tracking-[-0.03em] text-[#0A0E1E] sm:text-[56px] lg:text-[64px]">
                <span className="block">Your pipeline,</span>
                <span className="block italic font-normal text-[#2D4BFF]">finally in a loop.</span>
              </h1>
              <p className="mt-5 max-w-[520px] text-[16px] leading-7 text-[#5A6075] sm:text-[17px]">
                Loop is the CRM that behaves like your process: contacts loop into deals, deals loop into activity, activity loops back into revenue — no black hole. Try dragging a deal →
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href={isAuthed ? `/${workspaceSlug}/contacts` : "/signup"} className="inline-flex items-center gap-2 rounded-full bg-[#0A0E1E] px-6 py-3.5 text-[14px] font-medium text-white shadow-[0_12px_32px_rgba(10,14,30,0.22)] hover:translate-y-[-1px] transition-all">
                  {isAuthed ? "Open your workspace" : "Start free in 30 seconds"} <span className="flex size-6 items-center justify-center rounded-full bg-white text-[#0A0E1E] text-[12px]">↗</span>
                </Link>
                <button onClick={() => setSearchOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-[#E9EAF2] bg-white px-6 py-3.5 text-[14px] font-medium text-[#0E1220] hover:bg-[#F3F4F8] transition-colors">
                  <span className="size-2 rounded-full bg-[#2D4BFF]" /> Try ⌘K search
                </button>
                <span className="font-mono text-[11px] tracking-wide text-[#8A90A8]">No card required · demo@loopcrm.com</span>
              </div>
              <div className="mt-8 flex items-center gap-6 border-t border-[#E9EAF2] pt-6">
                <div className="flex -space-x-2">
                  <img src="https://i.pravatar.cc/100?img=11" alt="" className="size-8 rounded-full border-2 border-white object-cover" />
                  <img src="https://i.pravatar.cc/100?img=32" alt="" className="size-8 rounded-full border-2 border-white object-cover" />
                  <img src="https://i.pravatar.cc/100?img=15" alt="" className="size-8 rounded-full border-2 border-white object-cover" />
                  <span className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-[#0A0E1E] font-mono text-[10px] font-medium text-white">+2k</span>
                </div>
                <div className="text-sm leading-tight"><div className="font-medium tracking-tight">Trusted by 2,400+ pipelines</div><div className="flex items-center gap-1 text-[#5A6075]"><span className="text-[#FFB020]">★★★★★</span> 4.9/5 average</div></div>
                <div className="hidden items-center gap-2 sm:flex"><span className="h-8 w-px bg-[#E9EAF2]" /><div className="font-mono text-[11px] leading-none text-[#8A90A8]"><div>SOC 2 · Postgres</div><div>Full-text search</div></div></div>
              </div>
            </div>

            {/* Live specimen */}
            <div className="relative lg:pl-4">
              <div className="relative overflow-visible rounded-[28px] border border-[#E0E3F0] bg-white shadow-[0_32px_80px_rgba(12,18,36,0.14),0_8px_24px_rgba(12,18,36,0.06)]" style={{ transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)` }}>
                <div className="flex items-center justify-between border-b border-[#EEF0F6] bg-[#FBFBFA] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-[#0A0E1E] text-white text-[11px]">◐</span>
                    {/* interactive workspace selector */}
                    <div className="relative">
                      <button onClick={() => setShowWsMenu((v) => !v)} className="flex items-center gap-1.5 rounded-full border border-[#E9EAF2] bg-white px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] hover:bg-[#F6F7FB]">
                        <span className="flex size-5 items-center justify-center rounded-full text-[10px] text-white" style={{ background: ws.color }}>{ws.letter}</span>
                        {ws.name.toUpperCase()} · /{ws.slug} <span className="text-[#8A90A8]">▾</span>
                      </button>
                      {showWsMenu && (
                        <div className="absolute left-0 top-[110%] z-20 w-[220px] rounded-2xl border border-[#E9EAF2] bg-white p-1.5 shadow-xl">
                          {(Object.keys(WORKSPACES) as WsKey[]).map((k) => (
                            <button key={k} onClick={() => switchWs(k)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-[#F6F7FB] ${k === activeWs ? "bg-[#F0F3FF] ring-1 ring-[#D9DEFF]" : ""}`}>
                              <span className="flex size-7 items-center justify-center rounded-full text-xs text-white" style={{ background: WORKSPACES[k].color }}>{WORKSPACES[k].letter}</span>
                              <span className="font-medium">{WORKSPACES[k].name}</span>
                              <span className="ml-auto font-mono text-[11px] text-[#8A90A8]">/{WORKSPACES[k].slug}</span>
                              {k === activeWs && <span className="text-[#2D4BFF]">✓</span>}
                            </button>
                          ))}
                          <div className="mx-2 my-1 h-px bg-[#EEF0F6]" />
                          <div className="px-3 py-1 font-mono text-[11px] text-[#8A90A8]">Every query scoped by workspaceId</div>
                        </div>
                      )}
                    </div>
                    <span className="hidden rounded-full bg-[#E8F0FF] px-2 py-0.5 font-mono text-[10px] font-medium tracking-widest text-[#2D4BFF] sm:inline">LIVE</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setView("kanban")} className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${view === "kanban" ? "bg-[#0A0E1E] text-white" : "border border-[#E9EAF2] bg-white"}`}>Kanban</button>
                    <button onClick={() => setView("table")} className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${view === "table" ? "bg-[#0A0E1E] text-white" : "border border-[#E9EAF2] bg-white"}`}>Table</button>
                  </div>
                </div>

                {view === "kanban" ? (
                  <div className="grid grid-cols-3 gap-0 bg-[#F6F7FB] p-2.5">
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
                          className={`rounded-2xl p-2.5 shadow-sm ring-1 transition-all ${isDrop ? "bg-[#F0F3FF] ring-[#2D4BFF] scale-[1.01]" : "bg-white ring-[#E9EAF2]"}`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-[#5A6075]">{col.label.toUpperCase()}</span>
                            <span className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] ${isDrop ? "bg-[#2D4BFF] text-white" : "bg-[#F3F4F8] text-[#5A6075]"}`}>{colDeals.length}</span>
                          </div>
                          <div className="space-y-2">
                            {colDeals.map((d) => (
                              <div
                                key={d.id}
                                draggable
                                onDragStart={(e) => { setDragId(d.id); e.dataTransfer.setData("text/plain", d.id); e.dataTransfer.effectAllowed = "move" }}
                                onDragEnd={() => { setDragId(null); setDropStage(null) }}
                                className={`group cursor-grab rounded-xl border bg-white p-3 shadow-sm transition-all active:cursor-grabbing ${dragId === d.id ? "opacity-40 scale-[0.98] border-[#2D4BFF]/30" : "border-[#E9EAF2] hover:border-[#D9DEFF] hover:shadow-md"}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-[13px] font-medium leading-tight">{d.title}</div>
                                  <span className="hidden size-6 place-items-center rounded-full bg-[#F3F4F8] text-[10px] group-hover:grid">⋮</span>
                                </div>
                                <div className="mt-1 font-mono text-[11px] text-[#8A90A8]">{d.org}</div>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="font-mono text-[11px] font-medium text-[#2D4BFF]">${(d.value / 1000).toFixed(0)}k</span>
                                  <span className="flex items-center gap-1.5">
                                    <span className="size-6 rounded-full bg-[#0A0E1E] text-center font-mono text-[10px] leading-6 text-white">{d.owner}</span>
                                    <button onClick={() => {
                                        const next = col.key === "lead" ? "qualified" : col.key === "qualified" ? "closing" : "lead"
                                        moveDeal(d.id, next as Stage)
                                      }}
                                      className="rounded-full bg-[#0A0E1E] px-2 py-0.5 font-mono text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    >Move →</button>
                                  </span>
                                </div>
                              </div>
                            ))}
                            {isDrop && <div className="rounded-xl border-2 border-dashed border-[#2D4BFF]/40 bg-[#E8F0FF]/50 px-3 py-6 text-center font-mono text-[11px] text-[#2D4BFF]">Drop to {col.label} →</div>}
                            <button onClick={() => { const id = Math.random().toString(36).slice(2,6); const v = 15000+Math.floor(Math.random()*40000); setDeals(d => [...d, { id, title: `New Deal ${id}`, value: v, owner: "ME", stage: col.key, org: ws.name }]); setToast(`Added to ${col.label}`); setTimeout(()=>setToast(null),1500)}} className="w-full rounded-xl border border-dashed border-[#E0E3F0] bg-[#FBFBFA] px-3 py-2 text-center font-mono text-[11px] text-[#8A90A8] hover:bg-white hover:text-[#0A0E1E]">+ Add deal</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="bg-white p-2.5">
                    <div className="overflow-hidden rounded-2xl border border-[#E9EAF2]">
                      <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.5fr] gap-px bg-[#E9EAF2] font-mono text-[11px] tracking-[0.12em] text-[#8A90A8]">
                        <div className="bg-[#FBFBFA] px-3 py-2">DEAL</div><div className="bg-[#FBFBFA] px-3 py-2">ORG</div><div className="bg-[#FBFBFA] px-3 py-2">VALUE</div><div className="bg-[#FBFBFA] px-3 py-2">STAGE</div>
                      </div>
                      {deals.map((d) => (
                        <div key={d.id} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.5fr] gap-px bg-[#E9EAF2] text-sm">
                          <div className="bg-white px-3 py-2.5 font-medium">{d.title}</div>
                          <div className="bg-white px-3 py-2.5 text-[#5A6075]">{d.org}</div>
                          <div className="bg-white px-3 py-2.5 font-mono text-[#2D4BFF]">${d.value.toLocaleString()}</div>
                          <div className="bg-white px-3 py-2.5"><select value={d.stage} onChange={(e) => moveDeal(d.id, e.target.value as Stage)} className="rounded-full border border-[#E9EAF2] bg-[#F6F7FB] px-2 py-1 font-mono text-xs"><option value="lead">Lead</option><option value="qualified">Qualified</option><option value="closing">Closing</option></select></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 border-t border-[#EEF0F6] bg-white px-4 py-3">
                  <span className="font-mono text-[11px] tracking-[0.12em] text-[#8A90A8]">ACTIVITY</span>
                  <span className="h-px flex-1 bg-[#EEF0F6]" />
                  <span className="rounded-full bg-[#0A0E1E] px-2.5 py-1 font-mono text-[10px] tracking-widest text-white">STAGE CHANGES AUTO-LOGGED</span>
                </div>

                <div className="absolute -bottom-4 -left-3 hidden rounded-2xl border border-[#E9EAF2] bg-white px-4 py-3 shadow-[0_12px_32px_rgba(12,18,36,0.12)] sm:flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-[#E8F0FF] text-[#2D4BFF]">↗</span>
                  <div><div className="font-mono text-[11px] tracking-widest text-[#8A90A8]">PIPELINE VALUE · {ws.name.toUpperCase()}</div><div className="text-[15px] font-semibold tracking-tight">${(pipelineValue / 1000).toFixed(0)}k · {deals.length} deals</div></div>
                </div>
                <div className="absolute -right-2 -top-2 hidden rounded-full border border-[#E9EAF2] bg-white px-3 py-1.5 shadow-lg sm:flex items-center gap-2">
                  <span className="size-2 rounded-full bg-[#12B981] animate-pulse" /><span className="font-mono text-[11px] font-medium tracking-widest">SYNCED · 12ms</span>
                </div>
              </div>
              <p className="mx-auto mt-6 max-w-[420px] text-center font-mono text-[11px] leading-relaxed tracking-wide text-[#8A90A8]">Drag any card between columns — it logs the activity, updates the timeline and re-indexes search. Click “Move →” or use the Table view.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-[#E9EAF2] bg-[#E9EAF2] lg:grid-cols-4">
            {[
              { k: "AVG. SETUP", v: "4 min 12 sec", sub: "from signup to first deal" },
              { k: "SEARCH LATENCY", v: "< 40 ms", sub: "Postgres full-text, workspace-scoped" },
              { k: "ACTIVE WORKSPACES", v: "2,412", sub: "solo → 12-seat teams" },
              { k: "DEALS MOVED / WEEK", v: "18.4k", sub: "drag, log, close — on loop" },
            ].map((s) => (
              <div key={s.k} className="group bg-white px-6 py-5 hover:bg-[#FBFBFA] transition-colors"><div className="font-mono text-[11px] tracking-[0.14em] text-[#8A90A8]">{s.k}</div><div className="mt-1 font-[Instrument_Serif] text-[22px] tracking-tight text-[#0A0E1E] group-hover:text-[#2D4BFF] transition-colors">{s.v}</div><div className="font-mono text-[11px] text-[#8A90A8]">{s.sub}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURE BENTO */}
      <section id="product" className="mx-auto max-w-[1280px] px-6 py-14 lg:px-8 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div><div className="font-mono text-[11px] tracking-[0.18em] text-[#2D4BFF]">PRODUCT · THE LOOP SYSTEM</div><h2 className="mt-3 font-[Instrument_Serif] text-[32px] leading-[0.95] tracking-[-0.02em] sm:text-[40px]">Everything you track,<br /><span className="italic text-[#8A90A8]">nothing you babysit.</span></h2></div>
          <p className="max-w-[420px] text-[14px] leading-6 text-[#5A6075]">Contacts, orgs, deals, and activities aren&apos;t four tools — they&apos;re one loop. Edit anywhere, it reflects everywhere. <button onClick={() => setSearchOpen(true)} className="text-[#2D4BFF] underline">Try search now →</button></p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-12">
          <div className="group relative overflow-hidden rounded-[24px] border border-[#E9EAF2] bg-white p-6 lg:col-span-7 lg:p-8">
            <div className="absolute right-0 top-0 hidden h-[190px] w-[300px] rounded-bl-[32px] bg-[#F6F7FB] p-4 sm:block">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-[#8A90A8]"><span>CONTACT</span><span className="h-px flex-1 bg-[#E9EAF2]" /><span className="text-[#2D4BFF]">LIVE PREVIEW · {ws.name}</span></div>
                {ws.contacts.slice(0,1).map((c) => (
                  <div key={c.name} className="rounded-xl border border-[#E9EAF2] bg-white p-3">
                    <div className="flex items-center gap-2"><img src="https://i.pravatar.cc/100?img=22" alt="" className="size-7 rounded-full" /><span className="text-sm font-medium">{c.name}</span><span className="ml-auto rounded-full bg-[#E8F0FF] px-2 py-0.5 font-mono text-[10px] text-[#2D4BFF]">OWNER</span></div>
                    <div className="mt-3 flex gap-1.5"><span className="rounded-full bg-[#0A0E1E] px-2 py-1 font-mono text-[10px] text-white"># {c.tag}</span><span className="rounded-full border border-[#E9EAF2] px-2 py-1 font-mono text-[10px]"># warm</span></div>
                  </div>
                ))}
                <div className="space-y-1.5 pl-4"><div className="flex gap-2"><span className="mt-1 size-1.5 rounded-full bg-[#2D4BFF]" /><span className="h-2 w-32 rounded bg-[#E9EAF2]" /></div><div className="flex gap-2"><span className="mt-1 size-1.5 rounded-full bg-[#E9EAF2]" /><span className="h-2 w-28 rounded bg-[#EEF0F6]" /></div></div>
              </div>
            </div>
            <div className="relative max-w-[360px]"><div className="inline-flex size-9 items-center justify-center rounded-xl bg-[#0A0E1E] text-white">◈</div><h3 className="mt-4 font-[Instrument_Serif] text-[20px] leading-tight">Contacts with memory</h3><p className="mt-2 text-[14px] leading-6 text-[#5A6075]">Searchable, filterable, sortable — with a unified activity timeline, tags, linked deals, and bulk actions that actually save time.</p><ul className="mt-4 space-y-1.5 font-mono text-[12px] text-[#5A6075]"><li className="flex gap-2"><span className="text-[#2D4BFF]">→</span> Bulk tag · assign owner · export CSV</li><li className="flex gap-2"><span className="text-[#2D4BFF]">→</span> Command-K everywhere — <button onClick={() => setSearchOpen(true)} className="underline">open</button></li></ul></div>
          </div>
          <div className="rounded-[24px] border border-[#E9EAF2] bg-[#0A0E1E] p-6 text-white lg:col-span-5 lg:p-8">
            <div className="inline-flex size-9 items-center justify-center rounded-xl bg-white text-[#0A0E1E]">⬢</div><h3 className="mt-4 font-[Instrument_Serif] text-[20px]">Organizations that link themselves</h3><p className="mt-2 text-[14px] leading-6 text-white/70">Company profiles with linked contacts & deals. Loop suggests links by email domain — you confirm with one click.</p>
            <div className="mt-5 rounded-xl bg-white/10 p-3 backdrop-blur"><div className="flex items-center justify-between font-mono text-[11px] tracking-widest text-white/60"><span>DOMAIN MATCH</span><span className="text-white">{activeWs === "acme" ? "94%" : activeWs === "vela" ? "88%" : "76%"} · AUTO-SUGGEST</span></div><div className="mt-2 flex items-center gap-2 text-sm"><span className="size-2 rounded-full bg-[#12B981]" /> {activeWs === "acme" ? "atlassian.com → 8 contacts · 3 deals" : activeWs === "vela" ? "helios.inc → 5 contacts · 2 deals" : "lumen.co → 3 contacts"}</div>
              <button onClick={() => { setToast("Linked 3 contacts → org"); setTimeout(()=>setToast(null),1800)}} className="mt-3 w-full rounded-full bg-white py-2 text-xs font-medium text-[#0A0E1E] hover:bg-[#EEF0F6]">Confirm links →</button>
            </div>
          </div>
          <div className="rounded-[24px] border border-[#E9EAF2] bg-white p-6 lg:col-span-5"><div className="inline-flex size-9 items-center justify-center rounded-xl bg-[#E8F0FF] text-[#2D4BFF]">⇄</div><h3 className="mt-4 text-[16px] font-semibold tracking-tight">Deals: board + table, same truth</h3><p className="mt-2 text-[14px] leading-6 text-[#5A6075]">Kanban drag-and-drop that logs activity automatically. Flip to table for sort, filter, and pipeline stats without losing context.</p><div className="mt-4 flex gap-2 font-mono text-[11px]"><button onClick={() => setView("kanban")} className={`rounded-full px-3 py-1.5 ${view==="kanban" ? "bg-[#0A0E1E] text-white" : "border border-[#E9EAF2]"}`}>Kanban · interactive</button><button onClick={() => setView("table")} className={`rounded-full px-3 py-1.5 ${view==="table" ? "bg-[#0A0E1E] text-white" : "border border-[#E9EAF2]"}`}>Table</button></div></div>
          <div className="rounded-[24px] border border-[#E9EAF2] bg-white p-6 lg:col-span-4"><div className="inline-flex size-9 items-center justify-center rounded-xl bg-[#FFF0EE] text-[#FF2E1F]">✦</div><h3 className="mt-4 text-[16px] font-semibold tracking-tight">Activities that stay attached</h3><p className="mt-2 text-[14px] leading-6 text-[#5A6075]">Notes, emails, calls, meetings, tasks — on every record. “My Tasks” aggregates what&apos;s yours. Agent-ready with <span className="font-mono text-[12px]">source: manual | agent</span>.</p><div className="mt-3 flex gap-1.5"><span className="rounded-full bg-[#E8F5E9] px-2 py-1 font-mono text-[10px] text-[#1B7A3D]">{activities.length} today</span><span className="rounded-full border border-[#E9EAF2] px-2 py-1 font-mono text-[10px]">{ws.contacts.length} contacts</span></div></div>
          <div className="group relative overflow-hidden rounded-[24px] border border-[#2D4BFF]/15 bg-[#F0F3FF] p-6 lg:col-span-3"><div className="font-mono text-[11px] tracking-[0.14em] text-[#2D4BFF]">SEARCH</div><h3 className="mt-2 font-[Instrument_Serif] text-[18px] leading-tight">Workspace-scoped, instant</h3><p className="mt-2 text-[13px] leading-5 text-[#5A6075]">Postgres full-text across contacts, deals, orgs, activities. Scoped to your workspace — fast and private.</p><button onClick={() => setSearchOpen(true)} className="mt-4 flex w-full items-center gap-2 rounded-full border border-[#D9DEFF] bg-white px-3 py-2.5 shadow-sm hover:shadow"><span className="rounded bg-[#0A0E1E] px-1.5 py-0.5 font-mono text-[10px] text-white">⌘K</span><span className="h-3 w-px bg-[#E9EAF2]" /><span className="font-mono text-[12px] text-[#8A90A8]">Search {ws.name}...</span></button></div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" className="border-y border-[#E9EAF2] bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-12 lg:px-8 lg:py-16">
          <div className="flex flex-wrap items-baseline justify-between gap-4"><h2 className="font-[Instrument_Serif] text-[28px] tracking-[-0.02em] sm:text-[32px]">How the loop runs</h2><span className="font-mono text-[11px] tracking-[0.16em] text-[#8A90A8]">THREE MOVES · REPEAT FOREVER · TRY IT ABOVE</span></div>
          <div className="relative mt-10 grid gap-6 lg:grid-cols-3">
            <div aria-hidden className="absolute left-6 right-6 top-[44px] hidden h-px bg-[#E9EAF2] lg:block"><div className="absolute inset-y-0 left-0 w-1/3 bg-[#2D4BFF]" /></div>
            {[
              { label: "CAPTURE", title: "Everything lands in one place", desc: "Contacts, orgs, and deals flow in. Tags, owners, and domains auto-link.", icon: "◈", accent: "bg-[#0A0E1E] text-white" },
              { label: "MOVE", title: "Drag. It logs itself.", desc: "Move a deal — stage change becomes activity, timeline updates, search re-indexes.", icon: "⇄", accent: "bg-[#2D4BFF] text-white" },
              { label: "CLOSE", title: "Activity → revenue, visibly", desc: "Every note and call stays attached. Your “My Tasks” is always current.", icon: "✦", accent: "bg-[#FF2E1F] text-white" },
            ].map((s) => (
              <div key={s.label} className="relative rounded-[20px] border border-[#E9EAF2] bg-[#FCFCFA] p-6 hover:border-[#D9DEFF] hover:shadow-md transition-all"><div className={`inline-flex size-10 items-center justify-center rounded-xl text-sm ${s.accent}`}>{s.icon}</div><div className="mt-4 font-mono text-[11px] tracking-[0.16em] text-[#8A90A8]">{s.label}</div><h3 className="mt-1 font-[Instrument_Serif] text-[18px] leading-tight">{s.title}</h3><p className="mt-2 text-[13px] leading-6 text-[#5A6075]">{s.desc}</p></div>
            ))}
          </div>

          <div className="mt-10 overflow-hidden rounded-[24px] border border-[#1A1F35] bg-[#0A0E1E] p-6 text-white lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3"><span className="size-2 rounded-full bg-[#12B981] shadow-[0_0_10px_rgba(18,185,129,0.6)]" /><span className="font-mono text-[11px] tracking-[0.16em] text-white/60">LIVE WORKSPACE · {ws.name.toUpperCase()}</span><span className="hidden h-4 w-px bg-white/15 sm:block" /><button onClick={() => setSearchOpen(true)} className="hidden font-mono text-[11px] text-white/50 hover:text-white sm:inline">⌘K → “{searchQuery || "northstar"}” · {filteredSearch.deals.length} results in 31ms →</button></div>
              <span className="rounded-full bg-white px-3 py-1 font-mono text-[11px] font-medium tracking-widest text-[#0A0E1E]">MULTI-TENANT · SLUG ROUTING</span>
            </div>
            <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl bg-white p-4 text-[#0A0E1E]">
                <div className="flex items-center justify-between"><span className="font-mono text-[11px] tracking-[0.14em] text-[#8A90A8]">DEAL TIMELINE · LIVE</span><span className="font-mono text-[11px] text-[#2D4BFF]">{activities.length} activities</span></div>
                <div className="mt-3 space-y-2.5">
                  {activities.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 rounded-xl border border-[#EEF0F6] bg-[#FBFBFA] px-3 py-2.5 animate-[in_0.35s_ease]">
                      <span className={`rounded-full px-2 py-1 font-mono text-[10px] tracking-wide ${r.kind==="stage" ? "bg-[#E8F0FF] text-[#2D4BFF]" : r.kind==="call" ? "bg-[#E8F5E9] text-[#1B7A3D]" : r.kind==="task" ? "bg-[#FFF0EE] text-[#9A2B1F]" : "bg-[#F3F4F8] text-[#5A6075]"}`}>{r.title}</span>
                      <span className="text-[12px] text-[#5A6075]">{r.detail}</span>
                      <span className="ml-auto font-mono text-[11px] text-[#8A90A8]">{r.time}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => { const id=Math.random().toString(36).slice(2,6); setActivities(a=>[{ id, kind:"note", title:"Note added", detail:`“Loop demo note ${id}” — You · just now`, time:"now"}, ...a.slice(0,4)]); setToast("Note added → timeline"); setTimeout(()=>setToast(null),1500)}} className="mt-3 w-full rounded-xl border border-dashed border-[#E0E3F0] py-2 font-mono text-xs text-[#8A90A8] hover:bg-[#F6F7FB]">+ Add note to {ws.name}</button>
              </div>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="font-mono text-[11px] tracking-[0.16em] text-white/50">WORKSPACE SWITCHER · INTERACTIVE</div>
                  <div className="relative mt-2">
                    <button onClick={() => setShowWsMenuDark((v) => !v)} className="flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-left text-[#0A0E1E] hover:bg-[#F6F7FB]">
                      <span className="flex size-7 items-center justify-center rounded-full text-xs text-white" style={{ background: ws.color }}>{ws.letter}</span>
                      <span className="text-sm font-medium">{ws.name}</span>
                      <span className="ml-auto font-mono text-[11px] text-[#8A90A8]">/{ws.slug} ▾</span>
                    </button>
                    {showWsMenuDark && (
                      <div className="absolute left-0 right-0 top-[110%] z-20 rounded-2xl border border-[#E9EAF2] bg-white p-1.5 shadow-xl">
                        {(Object.keys(WORKSPACES) as WsKey[]).map((k) => (
                          <button key={k} onClick={() => switchWs(k)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#0A0E1E] hover:bg-[#F6F7FB] ${k===activeWs ? "bg-[#F0F3FF] ring-1 ring-[#D9DEFF]" : ""}`}>
                            <span className="flex size-7 items-center justify-center rounded-full text-xs text-white" style={{ background: WORKSPACES[k].color }}>{WORKSPACES[k].letter}</span>
                            <span>{WORKSPACES[k].name}</span><span className="ml-auto font-mono text-[11px] text-[#8A90A8]">/{WORKSPACES[k].slug}</span>{k===activeWs && <span className="text-[#2D4BFF]">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {(Object.keys(WORKSPACES) as WsKey[]).filter(k=>k!==activeWs).slice(0,2).map(k=> (
                      <button key={k} onClick={()=>switchWs(k)} className="flex w-full items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-left text-white/70 hover:bg-white/15">
                        <span className="flex size-7 items-center justify-center rounded-full bg-white/15 text-xs">{WORKSPACES[k].letter}</span>
                        <span className="text-sm">{WORKSPACES[k].name}</span><span className="ml-auto font-mono text-[11px]">/{WORKSPACES[k].slug}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 font-mono text-[11px] leading-4 text-white/50">Click to switch — notice pipeline, timeline, and search all update. Every query filtered by <span className="text-white">workspaceId</span>.</div>
                </div>
                <div className="rounded-2xl bg-[#2D4BFF] p-4 text-white"><div className="font-mono text-[11px] tracking-[0.14em] text-white/70">PERMISSIONS</div><div className="mt-1 text-sm leading-5">Every server action checks <span className="font-mono bg-white/15 px-1.5 py-0.5 rounded">workspaceId</span> and role — Owner / Admin / Member.</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-[1280px] px-6 py-14 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-[720px] text-center"><div className="font-mono text-[11px] tracking-[0.18em] text-[#2D4BFF]">PRICING · NO SEAT MATH TRICKS</div><h2 className="mt-3 font-[Instrument_Serif] text-[32px] leading-[0.95] tracking-[-0.02em] sm:text-[40px]">Start free. Scale when it loops.</h2><p className="mx-auto mt-3 max-w-[560px] text-[14px] leading-6 text-[#5A6075]">All plans include contacts, deals, orgs, activities, search, and workspace invites. Export CSV anytime — your data never held hostage.</p></div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {[
            { name: "Solo", price: "$19", note: "per month · 1 workspace", features: ["1 workspace", "Unlimited contacts & deals", "Kanban + table + stats", "Full-text search"], cta: "Start solo", featured: false },
            { name: "Team", price: "$49", note: "per month · up to 6 seats", features: ["3 workspaces", "Roles: Owner / Admin / Member", "Invite links + permissions", "Priority search & support"], cta: "Start team trial", featured: true },
            { name: "Studio", price: "$99", note: "per month · up to 12 seats", features: ["Unlimited workspaces", "All Phase-1 features", "Agent-ready API (Phase 2)", "SLA + onboarding"], cta: "Start studio trial", featured: false },
          ].map((p) => (
            <div key={p.name} className={`relative flex flex-col rounded-[24px] border p-6 lg:p-7 ${p.featured ? "border-[#2D4BFF] bg-[#0A0E1E] text-white shadow-[0_24px_64px_rgba(12,18,36,0.22)] lg:-translate-y-2" : "border-[#E9EAF2] bg-white"}`}>
              {p.featured && <span className="absolute -top-3 left-6 rounded-full bg-[#2D4BFF] px-3 py-1 font-mono text-[11px] tracking-[0.14em] text-white">MOST CHOSEN</span>}
              <div className="font-mono text-[11px] tracking-[0.16em] opacity-60">{p.name.toUpperCase()}</div>
              <div className="mt-2 flex items-baseline gap-1"><span className="font-[Instrument_Serif] text-[36px] leading-none tracking-tight">{p.price}</span><span className={`font-mono text-[11px] ${p.featured ? "text-white/60" : "text-[#8A90A8]"}`}>{p.note}</span></div>
              <ul className={`mt-6 space-y-2.5 text-[13px] ${p.featured ? "text-white/80" : "text-[#5A6075]"}`}>{p.features.map((f) => (<li key={f} className="flex gap-2"><span className={p.featured ? "text-white" : "text-[#2D4BFF]"}>✓</span> {f}</li>))}</ul>
              <Link href={isAuthed ? `/${workspaceSlug}/contacts` : "/signup"} className={`mt-7 inline-flex justify-center rounded-full px-5 py-3 text-[13px] font-medium transition-colors ${p.featured ? "bg-white text-[#0A0E1E] hover:bg-[#EEF0F6]" : "bg-[#0A0E1E] text-white hover:bg-black"}`}>{p.cta} →</Link>
              <span className={`mt-3 text-center font-mono text-[11px] ${p.featured ? "text-white/50" : "text-[#8A90A8]"}`}>14-day free · cancel anytime</span>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-dashed border-[#E0E3F0] bg-[#FBFBFA] px-6 py-4 text-center font-mono text-[12px] text-[#8A90A8]">Need self-hosted or Postgres on your VPC? <a href="mailto:hello@loopcrm.com" className="text-[#2D4BFF] underline">Talk to us</a> — we ship the same codebase you run locally.</div>
      </section>

      {/* MANIFESTO */}
      <section id="manifesto" className="border-y border-[#E9EAF2] bg-[#F6F7FB]">
        <div className="mx-auto max-w-[1280px] px-6 py-12 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div><div className="font-mono text-[11px] tracking-[0.18em] text-[#2D4BFF]">MANIFESTO</div><h2 className="mt-3 font-[Instrument_Serif] text-[28px] leading-[0.95] tracking-[-0.02em]">CRM shouldn&apos;t be <br />a second job.</h2><p className="mt-4 max-w-[420px] text-[14px] leading-6 text-[#5A6075]">We built Loop for founders who sell between building. No bloated enterprise ritual. Just a loop that keeps your pipeline honest while you stay in flow.</p><div className="mt-6 flex gap-3"><Link href={isAuthed ? `/${workspaceSlug}/contacts` : "/signup"} className="rounded-full bg-[#0A0E1E] px-5 py-2.5 text-sm font-medium text-white">Enter Loop</Link><Link href="/login" className="rounded-full border border-[#E9EAF2] bg-white px-5 py-2.5 text-sm font-medium">See demo data</Link></div></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { q: "“Finally a CRM I open daily. Drag → done, no admin hour.”", a: "— Maya, Indie Studio, 2 seats" },
                { q: "“Search is absurdly fast. I live in ⌘K now.”", a: "— Alex, Freelance Dev" },
                { q: "“Multi-workspace without chaos. Clients separated, brain calm.”", a: "— Priya, Ops Lead, 6 seats" },
                { q: "“The timeline is the product. Every move remembered.”", a: "— Jon, Solo Founder" },
              ].map((t) => (
                <div key={t.q} className="rounded-2xl border border-[#E9EAF2] bg-white p-5 hover:shadow-md transition-shadow"><div className="font-[Instrument_Serif] text-[15px] leading-snug">{t.q}</div><div className="mt-2 font-mono text-[11px] text-[#8A90A8]">{t.a}</div></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#0A0E1E] text-white">
        <div className="mx-auto max-w-[1280px] px-6 py-10 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div><div className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-[9px] bg-white text-[#0A0E1E]">◐</span><span className="text-[13px] font-semibold tracking-[0.18em]">LOOP</span><span className="text-[13px] font-light tracking-[0.12em] text-white/50">CRM</span></div><p className="mt-3 max-w-[360px] text-[13px] leading-6 text-white/60">Multi-tenant CRM for solo founders, freelancers, and small sales teams. Phase 1 live. <span className="font-mono text-white/80">⌘K</span> anywhere — try the interactive demo above.</p><div className="mt-4 flex gap-2 font-mono text-[11px] tracking-wide text-white/40"><span>© 2026 Loop</span><span>·</span><a href="#" className="hover:text-white">Privacy</a><span>·</span><a href="#" className="hover:text-white">Terms</a></div></div>
            <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
              <div><div className="font-mono text-[11px] tracking-[0.16em] text-white/40">PRODUCT</div><ul className="mt-3 space-y-2 text-white/70"><li><a href="#product" className="hover:text-white">Features</a></li><li><a href="#workflow" className="hover:text-white">Workflow</a></li><li><a href="#pricing" className="hover:text-white">Pricing</a></li><li><Link href="/login" className="hover:text-white">Demo login</Link></li></ul></div>
              <div><div className="font-mono text-[11px] tracking-[0.16em] text-white/40">CRAFT</div><ul className="mt-3 space-y-2 text-white/70"><li><span>Next.js 16 · Prisma 7</span></li><li><span>Postgres · NextAuth v5</span></li><li><span>shadcn/ui · Tailwind v4</span></li><li><span>Vercel-ready</span></li></ul></div>
              <div className="col-span-2 sm:col-span-1"><div className="font-mono text-[11px] tracking-[0.16em] text-white/40">START</div><div className="mt-3 rounded-2xl bg-white p-3 text-[#0A0E1E]"><div className="text-sm font-medium">demo@loopcrm.com</div><div className="font-mono text-[12px] text-[#5A6075]">password123 · workspace /acme</div><Link href={isAuthed ? `/${workspaceSlug}/contacts` : "/signup"} className="mt-3 flex w-full justify-center rounded-full bg-[#0A0E1E] py-2 text-sm font-medium text-white">Get started →</Link></div></div>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes loopRun { 0% { left: -12px } 100% { left: 100% } }
        @keyframes in { from { opacity:0; transform: translateY(6px) scale(0.98) } to { opacity:1; transform: translateY(0) scale(1) } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>
    </div>
  )
}
