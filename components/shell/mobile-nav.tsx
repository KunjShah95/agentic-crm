"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"

import { cn } from "@/lib/utils"
import { Logo } from "@/components/ds/logo"
import { NAV_GROUPS, NAV_SETTINGS, type NavItem } from "@/components/shell/nav-config"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

/**
 * The sidebar, as a drawer.
 *
 * It is deliberately the *same* object as the rail rather than a light-surface
 * approximation of it: the drawer paints `bg-sidebar`, so on a phone the app
 * opens as a black panel over the workspace. A drawer that looked different from
 * the rail it stands in for is the single most common way mobile navigation
 * reads as a separate, lesser app.
 */
export function MobileNav({
  workspaceSlug,
  workspaceName,
}: {
  workspaceSlug: string
  workspaceName: string
}) {
  const pathname = usePathname()

  /*
   * "Open" is derived, not mirrored.
   *
   * The obvious implementation is `useEffect(() => setOpen(false), [pathname])`,
   * but that is a setState in an effect body: it cascades a render on every
   * navigation and fires once on mount for no reason. Instead we remember the
   * path the drawer was opened *at*. Any navigation moves the live pathname away
   * from that value, which makes the drawer close by derivation — and it closes
   * on browser back/forward too, not just on link clicks.
   */
  const [openedAt, setOpenedAt] = React.useState<string | null>(null)
  const open = openedAt === pathname

  function setOpen(next: boolean) {
    setOpenedAt(next ? pathname : null)
  }

  function isActive(href: string) {
    return pathname.split("/")[2] === href
  }

  function row(item: NavItem) {
    const active = isActive(item.href)
    return (
      <Link
        key={item.href}
        href={`/${workspaceSlug}/${item.href}`}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex h-[38px] items-center gap-3 rounded-sm pl-3 pr-2.5",
          "text-[13.5px] tracking-[-0.011em] transition-colors duration-150",
          active
            ? "bg-white/[0.11] font-bold text-white"
            : "font-normal text-white/60 hover:bg-white/[0.06] hover:text-white"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-[8px] left-0 w-[2px] rounded-full bg-white",
            "opacity-0 transition-opacity duration-150",
            active && "opacity-100"
          )}
        />
        <item.icon
          strokeWidth={active ? 2.1 : 1.7}
          aria-hidden
          className={cn(
            "size-[17px] shrink-0 transition-colors duration-150",
            active ? "text-white" : "text-white/45 group-hover:text-white/80"
          )}
        />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.hint ? (
          <span className="shrink-0 text-[11px] text-white/35">{item.hint}</span>
        ) : null}
      </Link>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open navigation menu"
        className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-[#e4e4e4] bg-white text-[#0d0d0d] transition-colors hover:bg-[#f5f5f5] md:hidden"
      >
        <Menu className="size-4" strokeWidth={1.8} />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[280px] gap-0 border-r-0 bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetHeader className="border-b border-sidebar-border p-4 text-left">
          <SheetTitle className="font-normal text-white">
            <Logo />
          </SheetTitle>
          <p className="truncate text-[12px] text-white/40">{workspaceName}</p>
        </SheetHeader>
        <nav aria-label="Workspace" className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label ?? `group-${gi}`} className={gi > 0 ? "mt-4" : undefined}>
              {group.label ? (
                <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-white/30">
                  {group.label}
                </p>
              ) : null}
              <div className="relative flex flex-col gap-[2px]">
                {group.items.map((item) => row(item))}
              </div>
            </div>
          ))}
          <div className="mt-auto border-t border-sidebar-border pt-3">
            {row(NAV_SETTINGS)}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
