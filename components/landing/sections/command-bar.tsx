"use client"

import type { ComponentType, ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"
import { Search, ArrowUp, Send, Calendar, Phone, FileText } from "lucide-react"

/**
 * Command bar — master prompt #4.
 *
 * Estate360 as an assistant, not software. Natural-language commands that map
 * directly to actions. Keyboard shortcut ⌘/Ctrl + K.
 */
const COMMANDS = [
  { label: "Show me leads not contacted in 2 days.", icon: Search },
  { label: "Which 3BHK buyers are likely to book this week?", icon: Search },
  { label: "Send the cost sheet to Rahul.", icon: Send },
  { label: "Schedule a visit for Priya tomorrow.", icon: Calendar },
  { label: "Call Amit Patel now.", icon: Phone },
  { label: "Create a demand letter for A-1204.", icon: FileText },
]

export function CommandBarSection() {
  return (
    <section className="border-y bg-muted/30">
      <div className="mx-auto max-w-[1100px] px-6 py-14 lg:px-8 lg:py-20">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-foreground/70">
            <Search className="size-3 text-brand" /> Type what you need
          </span>
          <h2 className="mt-3 font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[36px]">
            One box. Any question.
          </h2>
          <p className="mx-auto mt-3 max-w-[560px] text-[14px] leading-6 text-muted-foreground">
            Ask in plain English. Estate360 finds the lead, drafts the message, books the visit, or pulls the demand letter — without you drilling through menus.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-[720px]">
          <Card className="border-border/60 shadow-e2">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Kbd className="text-[10px]">⌘</Kbd>
                <Kbd className="text-[10px]">K</Kbd>
                <span className="ml-2 text-[11px] font-medium text-muted-foreground">Command bar</span>
              </div>
              <CardTitle className="text-[15px] font-medium">What should I do now?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] text-muted-foreground focus-within:border-brand">
                <Search className="size-3.5 text-muted-foreground/60" aria-hidden />
                <input
                  type="text"
                  readOnly
                  aria-readonly
                  className="w-full bg-transparent outline-none placeholder:text-muted-foreground/50"
                  placeholder="Try: “Which deals are stuck?”"
                />
                <ArrowUp className="size-3.5 text-muted-foreground/60" aria-hidden />
              </div>
              <div className="mt-3 grid gap-1.5">
                {COMMANDS.map((c) => (
                  <CommandRow key={c.label} icon={c.icon}>{c.label}</CommandRow>
                ))}
              </div>
            </CardContent>
          </Card>
          <CardDescription className="mt-4 text-center text-[12px] text-muted-foreground">
            Press <kbd className="inline-flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 font-mono">⌘ K</kbd> from anywhere — even mid-WhatsApp reply.
          </CardDescription>
        </div>
      </div>
    </section>
  )
}

function CommandRow({
  icon,
  children,
}: {
    icon: ComponentType<{ className?: string }>
  children: ReactNode
}) {
  const Icon = icon
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition-colors"
      )}
    >
      <Icon className="size-3.5 text-muted-foreground/60" aria-hidden />
      <span className="text-muted-foreground">{children}</span>
    </div>
  )
}
