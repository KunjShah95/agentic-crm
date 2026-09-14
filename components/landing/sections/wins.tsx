"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { CheckCircle2, TrendingUp, Package, ClipboardCheck } from "lucide-react"

/**
 * Daily wins loop — master prompt #19/#20/#21.
 *
 * Morning Brief → progress through the day → End-of-Day Summary.
 * This is the habit loop that makes Estate360 something you open every morning.
 */
const MORNING = [
  { label: "Weighted pipeline", value: "₹2.4Cr" },
  { label: "New leads", value: "12" },
  { label: "Hot leads", value: "4" },
  { label: "Site visits today", value: "6" },
  { label: "Follow-ups overdue", value: "3" },
  { label: "Deals at risk", value: "2" },
]

const WINS = [
  { icon: TrendingUp, label: "11 leads contacted" },
  { icon: Package, label: "4 follow-ups completed" },
  { icon: ClipboardCheck, label: "2 site visits completed" },
  { icon: CheckCircle2, label: "3 cost sheets sent" },
]

export function WinsSection({ isAuthed, workspaceSlug }: { isAuthed: boolean; workspaceSlug?: string | null }) {
  const cta = isAuthed && workspaceSlug ? `/${workspaceSlug}/today` : "/signup"
  return (
    <section className="border-y bg-background">
      <div className="mx-auto max-w-[1280px] px-6 py-14 lg:px-8 lg:py-20">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/70">
            <CheckCircle2 className="size-3 text-success" /> The daily loop
          </span>
          <h2 className="mt-3 font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[36px]">
            Your day, measured in motion.
          </h2>
          <p className="mx-auto mt-3 max-w-[560px] text-[14px] leading-6 text-muted-foreground">
            Estate360 tracks the work that moves bookings — not vanity metrics. Progress in the morning, wins at day’s end, a sharper briefing the next morning.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_1fr]">
          {/* Morning brief */}
          <Card className="bento-depth border-border/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-e2">
            <CardHeader className="pb-2">
              <CardTitle className="text-[16px] tracking-tight flex items-center gap-1.5">
                <span className="flex size-6 items-center justify-center rounded-lg bg-brand/10 text-brand">📋</span> Your 9:00 AM Brief
              </CardTitle>
              <CardDescription>Everything you need to see before the first call.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {MORNING.map((m) => (
                  <div key={m.label} className="rounded-xl border bg-muted/30 p-3">
                    <div className="font-mono text-[11px] text-muted-foreground">{m.label}</div>
                    <div className="mt-0.5 text-[20px] font-semibold tabular-nums">{m.value}</div>
                  </div>
                ))}
              </div>
              <CardDescription className="block text-[13px]">
                Best opportunity: <span className="font-medium text-foreground">Rahul Shah — ₹82L</span>. Focus: follow up before 11 AM.
              </CardDescription>
            </CardContent>
          </Card>

          {/* End-of-day wins */}
          <Card className="bento-depth border-border/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-e2">
            <CardHeader className="pb-2">
              <CardTitle className="text-[16px] tracking-tight flex items-center gap-1.5">
                <span className="flex size-6 items-center justify-center rounded-lg bg-success/10 text-success">🎉</span> Today&apos;s Wins
              </CardTitle>
              <CardDescription>7 / 10 important actions completed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={70} className="h-2" />
              <ul className="space-y-2">
                {WINS.map((w) => {
                  const Icon = w.icon
                  return (
                    <li key={w.label} className="flex items-center gap-2 text-[13px]">
                      <span className="flex size-5 items-center justify-center rounded-full bg-success/10 text-success">
                        <Icon className="size-3" aria-hidden />
                      </span>
                      <span className="text-muted-foreground">{w.label}</span>
                    </li>
                  )
                })}
              </ul>
              <p className="text-[12px] text-muted-foreground">
                Tomorrow: 3 important follow-ups carry over. Estate360 surfaces them at 9 AM.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 text-center">
          <Button size="lg" className="h-11 gap-2 rounded-full px-7" render={<Link href={cta} />}>
            {isAuthed ? "Open your workspace" : "Start free — 14 days"}
            <TrendingUp className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </section>
  )
}
