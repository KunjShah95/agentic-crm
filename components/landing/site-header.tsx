"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/shell/mode-toggle"
import { ArrowRight, Layers, Menu, X } from "lucide-react"
import { NAV_LINKS } from "@/components/landing/site-config"
import { cn } from "@/lib/utils"
import { GTM_EVENTS, trackEvent } from "@/lib/analytics"

type Props = {
  isAuthed: boolean
  workspaceSlug?: string | null
  compact?: boolean
}

export function SiteHeader({ isAuthed, workspaceSlug, compact }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const primaryHref = isAuthed && workspaceSlug ? `/${workspaceSlug}/dashboard` : "/signup"

  return (
    <header className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/60">
      <div className={cn("relative mx-auto flex h-[64px] w-full max-w-[1280px] items-center justify-between px-6 lg:px-8", compact && "h-14")}>
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Estate360 home">
          {/* Amber logo mark — brand-colored, not generic black */}
          <span className="flex size-8 items-center justify-center rounded-sm bg-brand shadow-sm transition-shadow group-hover:shadow-md">
            <Layers className="size-4 text-brand-foreground" aria-hidden />
          </span>
          <span className="text-[13px] font-semibold tracking-[0.18em]">ESTATE360</span>
          <span className="hidden text-[13px] font-light tracking-[0.12em] text-muted-foreground sm:inline">CRM</span>
        </Link>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 text-[13px] font-medium md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  /* `py-2 -my-2` rather than `pb-1`. The old padding gave a
                     13px label a ~23.5px hit box, which is fractionally under the
                     24px AA floor and reads as "nearly fine" right up until
                     someone on a touch screen misses it. Negative margin pulls
                     the extra padding back out so the optical position and the
                     64px header height are unchanged — only the target grows.

                     Real padding rather than `.tap-target` here, because this link
                     owns its own `::after` for the active underline and the two
                     pseudo-elements would collide. The underline stays anchored to
                     the text because `after:bottom-0` resolves against the padding
                     box, which `-my-2` has already pulled back to its original
                     place. */
                  "relative -my-2 py-2 transition-colors",
                  active
                    ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-brand after:content-['']"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ModeToggle />
          {!isAuthed ? (
            <>
              <Button variant="ghost" size="sm" className="rounded-md text-[13px]" render={<Link href="/login" />}>
                Sign in
              </Button>
              <Button
                variant="brand"
                size="sm"
                className="gap-1.5 rounded-md text-[13px]"
                render={
                  <Link
                    href="/signup"
                    onClick={() => trackEvent(GTM_EVENTS.headerStartFree, { location: "header" })}
                  />
                }
              >
                Start free <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </>
          ) : (
            <Button size="sm" className="gap-1.5 rounded-md" render={<Link href={primaryHref} />}>
              Go to workspace <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md md:hidden"
        >
          {mobileOpen ? (
            <X className="size-4" aria-hidden />
          ) : (
            <Menu className="size-4" aria-hidden />
          )}
        </Button>
      </div>
      {mobileOpen && (
        <div className="animate-in fade-in slide-in-from-top-2 border-t bg-popover px-6 py-6 md:hidden">
          <nav className="flex flex-col gap-1 text-sm font-medium" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-sm px-2 py-2.5 hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
            <Button
              variant="brand"
              className="mt-3 rounded-md"
              render={<Link href={primaryHref} onClick={() => setMobileOpen(false)} />}
            >
              {isAuthed ? "Open workspace" : "Start free"}
            </Button>
            {!isAuthed && (
              <Button
                variant="outline"
                className="mt-2 rounded-md"
                render={<Link href="/login" onClick={() => setMobileOpen(false)} />}
              >
                Sign in
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
