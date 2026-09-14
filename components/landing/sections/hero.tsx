"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { ShaderBackground } from "@/components/landing/shader-background"
import { SpotlightGrid } from "@/components/landing/spotlight-grid"
import { ArrowRight, ArrowUpRight, ShieldCheck, Phone, MessageSquare, BellDot } from "lucide-react"

/**
 * Hero — master prompt #31.
 * Philosophy #1: "Open Estate360. Know exactly what to do next."
 * H1 leads with the daily benefit, not a feature list. The hero LCP image is the
 * new "Today" command center — what users open every morning. Signature motion
 * layers (ShaderBackground + SpotlightGrid) are retained across all marketing heroes.
 */
export function HeroSection({
  isAuthed,
  workspaceSlug,
}: {
  isAuthed: boolean
  workspaceSlug?: string | null
}) {
  const primaryHref = isAuthed && workspaceSlug ? `/${workspaceSlug}/dashboard` : "/signup"

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20">
        <div className="absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black_0%,black_55%,transparent_100%)]">
          <ShaderBackground className="absolute inset-0" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--hero-wash-from)]/60 via-[var(--hero-wash-to)]/35 to-background" />
      </div>
      <SpotlightGrid className="-z-10" />

      <div className="relative mx-auto max-w-[1280px] px-6 lg:px-8">
        <div className="grid gap-10 pb-10 pt-10 lg:grid-cols-[1fr_1.02fr] lg:gap-12 lg:pb-20 lg:pt-[56px]">
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full border bg-card/80 px-3 py-1 text-[12px] font-medium text-muted-foreground backdrop-blur">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden />
              Your sales day, orchestrated
            </div>
            <h1 className="mt-5 font-display text-[40px] font-[600] leading-[1.02] tracking-[-0.03em] text-balance sm:text-[50px] lg:text-[58px]">
              <span className="block animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100 [animation-fill-mode:both]">
                Stop managing leads.
              </span>
              <span className="block text-brand animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 [animation-fill-mode:both]">
                Start closing them.
              </span>
            </h1>
            <p className="mt-5 max-w-[560px] text-[16px] leading-7 text-muted-foreground sm:text-[17px] animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 [animation-fill-mode:both]">
              Estate360 turns enquiries, WhatsApp conversations, site visits, inventory, bookings and collections into one daily workflow for Indian real-estate teams.{" "}
              <span className="font-medium text-foreground">Open it. It tells you what to do next.</span>
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-400 [animation-fill-mode:both]">
              <Button size="lg" className="h-11 gap-2 rounded-full px-7" render={<Link href={primaryHref} />}>
                {isAuthed ? "Open your workspace" : "Start free in 30 seconds"}
                <ArrowUpRight className="size-4" aria-hidden />
              </Button>
              <Button variant="outline" size="lg" className="h-11 gap-2 rounded-full border-border/60 bg-card px-6" render={<Link href="#story" />}>
                See a booking happen
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <ShieldCheck className="size-3.5 text-success" /> No card required
              </span>
            </div>
            <div className="mt-8 flex items-center gap-2.5 text-[12px] text-muted-foreground">
              <kbd className="flex items-center gap-1 rounded-md border bg-background px-1.5 py-1 font-mono">⌘ K</kbd>
              <span>Type "what should I do now?" to try the command bar.</span>
            </div>
          </div>
                    {/* ── RIGHT: the "Today" command center — hero LCP image ── */}
          <div className="relative lg:pl-2">
            <div className="relative overflow-hidden rounded-[20px] border bg-card shadow-e3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 [animation-fill-mode:both]">
              <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5">
                <span className="size-3 rounded-full bg-red-400" aria-hidden />
                <span className="size-3 rounded-full bg-amber-400" aria-hidden />
                <span className="size-3 rounded-full bg-green-400" aria-hidden />
                <span className="ml-2 font-mono text-[11px] text-muted-foreground">today.estate360.app</span>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">Today</span>
              </div>
              <div className="p-4 pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-muted-foreground">Good morning, Hemal 👋</p>
                    <p className="mt-0.5 text-[17px] font-semibold leading-tight">You have 7 things worth doing today.</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">9:02 AM</span>
                </div>
                <div className="mt-4 space-y-3.5">
                  <Card className="border-border/60">
                    <CardHeader className="pb-2 pl-3 pr-3 pt-3">
                      <div className="flex items-center gap-1.5 text-[12px] font-medium">
                        <span aria-hidden>🔥</span> 3 hot leads haven&apos;t been contacted
                      </div>
                      <CardDescription className="text-[11px]">Rahul Shah · 3BHK · SG Highway · Last activity: 19h ago · High intent</CardDescription>
                    </CardHeader>
                    <div className="flex gap-1.5 border-t border-border/60 px-3 py-2">
                      <Button size="sm" className="h-6 gap-1 rounded-full text-[11px]"><Phone className="size-3" /> Call now</Button>
                      <Button size="sm" variant="ghost" className="h-6 gap-1 rounded-full text-[11px]"><MessageSquare className="size-3" /> WhatsApp</Button>
                    </div>
                  </Card>
                  <Card className="border-border/60">
                    <CardHeader className="pb-2 pl-3 pr-3 pt-3">
                      <div className="flex items-center gap-1.5 text-[12px] font-medium">
                        <span aria-hidden>📅</span> Priya Mehta — site visit tomorrow
                      </div>
                      <CardDescription className="text-[11px]">Asked about payment plan · Suggested: send cost sheet</CardDescription>
                    </CardHeader>
                    <div className="flex gap-1.5 border-t border-border/60 px-3 py-2">
                      <Button size="sm" variant="secondary" className="h-6 gap-1 rounded-full text-[11px]">Send cost sheet</Button>
                    </div>
                  </Card>
                  <Card className="border-border/60">
                    <CardHeader className="pb-2 pl-3 pr-3 pt-3">
                      <div className="flex items-center gap-1.5 text-[12px] font-medium">
                        <span aria-hidden>⚠️</span> A-1204 — booking at risk
                      </div>
                      <CardDescription className="text-[11px]">Payment milestone overdue · Buyer: Rahul Shah</CardDescription>
                    </CardHeader>
                    <div className="flex gap-1.5 border-t border-border/60 px-3 py-2">
                      <Button size="sm" variant="outline" className="h-6 gap-1 rounded-full text-[11px]">Follow up</Button>
                      <Button size="sm" variant="ghost" className="h-6 gap-1 rounded-full text-[11px]"><BellDot className="size-3" /> Remind me</Button>
                    </div>
                  </Card>
                </div>
                <div className="mt-4 border-t border-border/60 pt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>7/10 important actions completed today</span>
                    <span>You&apos;re on track.</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                    <div className="h-1.5 w-[70%] rounded-full bg-brand" />
                  </div>
                </div>
              </div>
            </div>
            <div aria-hidden className="absolute -bottom-6 -right-6 hidden w-32 h-32 rounded-full bg-brand/10 blur-3xl sm:block" />
          </div>
        </div>
      </div>
    </section>
  )
}
