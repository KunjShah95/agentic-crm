"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"

export function StickyMobileCta() {
  const { data: session } = useSession()
  const workspaces = (session as { workspaces?: { slug: string }[] } | null)?.workspaces
  const isAuthed = !!session?.user
  const href = isAuthed && workspaces?.[0]?.slug ? `/${workspaces[0].slug}/contacts` : "/signup"

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2 rounded-full border bg-background/95 p-1.5 pl-4 shadow-e2 backdrop-blur-xl">
        <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted-foreground">
          {isAuthed ? "Continue in your workspace" : "14-day free · no card"}
        </p>
        <Button size="sm" className="shrink-0 gap-1 rounded-full" render={<Link href={href} />}>
          {isAuthed ? "Open" : "Start free"}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
