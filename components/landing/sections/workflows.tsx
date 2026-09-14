"use client"

import type { ComponentType } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Zap,
  MapPin,
  Clock,
  ThermometerSun,
  TrendingUp,
  FileText,
  MessageSquare,
  Smartphone,
} from "lucide-react"

/**
 * Workflows — master prompt §2–§15, §28.
 *
 * Benefit-led cards that answer "what manual work did this remove?"
 * No "AI-powered" labels (§32). Each card pairs a benefit headline with the
 * concrete action Estate360 performs, so the value is immediately legible.
 */
type Workflow = {
    icon: ComponentType<{ className?: string }>
  title: string
  detail: string
  accent?: boolean
}

const WORKFLOWS: Workflow[] = [
  {
    icon: Zap,
    title: "Know which lead needs a call next",
    detail: "Every record carries a Next Best Action built from site visits, cost-sheet opens, and time since last contact — with a one-tap Call or WhatsApp.",
    accent: true,
  },
  {
    icon: ThermometerSun,
    title: "Leads that tell you their temperature",
    detail: "Hot · Warm · Nurture · Cold, with the reason surfaced: site visit done, cost sheet opened 3×, asked about EMI. No guessing.",
  },
  {
    icon: MapPin,
    title: "Find the right unit in seconds",
    detail: "Natural-language property matching — “3BHK under ₹90L near SG Highway, 2028 possession” — returns ranked matches ready to send.",
  },
  {
    icon: TrendingUp,
    title: "Deals that won't wait",
    detail: "A dedicated at-risk view surfaces stalled bookings and overdue milestones before the user notices — with the follow-up to send.",
  },
  {
    icon: Clock,
    title: "Follow-ups that don't get lost",
    detail: "Forgotten leads, overdue tasks, missed calls auto-collected into today / upcoming / overdue. Tap to call, WhatsApp, or reschedule.",
  },
  {
    icon: FileText,
    title: "Cost sheets in seconds",
    detail: "Base + GST + stamp + others → total, pre-filled from the unit and buyer. Preview PDF, send on WhatsApp, download.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp that writes itself",
    detail: "Draft replies in the buyer's language (gu/hi/en) with UPI links attached. You review and send — never automatic on money.",
  },
  {
    icon: Smartphone,
    title: "Visits that verify themselves",
    detail: "200m GPS check-in, one-tap call, photo + voice note on the same 20-second flow. Offline where the network drops.",
  },
]

export function WorkflowsSection() {
  return (
    <section id="product" className="mx-auto max-w-[1280px] px-6 py-14 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-[720px] text-center">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/70">
          <Zap className="size-3 text-brand" /> The work Estate360 removes
        </span>
        <h2 className="mt-3 font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[36px]">
          Eight workflows. No spreadsheets.
        </h2>
        <p className="mx-auto mt-3 max-w-[560px] text-[14px] leading-6 text-muted-foreground">
          Every feature here replaces steps your team currently does by hand — chasing WhatsApp threads, copying prices into Excel, remembering who visited last week.
        </p>
      </div>

      <div className="mt-10 mx-auto max-w-[1200px] grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {WORKFLOWS.map((w) => (
          <WorkflowCard key={w.title} workflow={w} />
        ))}
      </div>
    </section>
  )
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const Icon = workflow.icon
  return (
    <Card
      className={cn(
        "bento-depth flex h-full flex-col border-border/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-e2 group"
      )}
    >
      <CardHeader className="pb-2">
        <div
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-xl",
            workflow.accent
              ? "bg-brand text-brand-foreground"
              : "bg-foreground text-background"
          )}
        >
          <Icon className="size-4" aria-hidden />
        </div>
        <CardTitle className="mt-2 text-[15px] font-semibold tracking-tight">{workflow.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <CardDescription className="leading-relaxed">{workflow.detail}</CardDescription>
      </CardContent>
    </Card>
  )
}
