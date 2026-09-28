"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, KanbanSquare, MoreHorizontal, Users } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Thumb-reachable primary actions only. Everything else lives behind "More",
 * which opens the full drawer — four items is the most a bottom bar can carry
 * before labels stop being readable at 375px.
 *
 * "More" is active for every route that is not one of the three primaries, so
 * the highlighted tab always tells the truth about where you are.
 */
const NAV_ITEMS = [
  { href: "dashboard", label: "Home", icon: LayoutDashboard },
  { href: "contacts", label: "Contacts", icon: Users },
  { href: "deals", label: "Deals", icon: KanbanSquare },
  { href: "more", label: "More", icon: MoreHorizontal },
] as const

const PRIMARY = ["dashboard", "contacts", "deals"]

export function BottomNav({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname()
  const segment = pathname.split("/")[2] ?? ""

  function isActive(href: string) {
    return href === "more" ? !PRIMARY.includes(segment) : segment === href
  }

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          const href = `/${workspaceSlug}/${item.href === "more" ? "dashboard" : item.href}`
          return (
            <Link
              key={item.href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 py-2",
                "text-[10.5px] font-medium transition-colors duration-150",
                active ? "text-brand" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {/*
                The active marker sits above the icon rather than tinting it
                alone. On a 10.5px label, colour alone is too weak a signal —
                the shape change is what reads at arm's length.
              */}
              <span
                aria-hidden
                className={cn(
                  "h-0.5 w-5 rounded-full bg-brand transition-opacity duration-150",
                  active ? "opacity-100" : "opacity-0"
                )}
              />
              <item.icon
                aria-hidden
                strokeWidth={active ? 2.25 : 1.75}
                className="size-5"
              />
              <span className="leading-none">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
