"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, KanbanSquare, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/deals", label: "Deals", icon: KanbanSquare },
  { href: "more", label: "More", icon: MoreHorizontal },
] as const

export function BottomNav({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === "more") {
      const segment = pathname.split("/")[2]
      return !["dashboard", "contacts", "deals"].includes(segment ?? "")
    }
    return pathname.includes(href)
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="grid grid-cols-4 gap-1 px-2 py-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          const href = item.href === "more"
            ? `/${workspaceSlug}/settings`
            : `/${workspaceSlug}${item.href}`
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-medium transition-colors",
                active
                  ? "text-brand"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("size-5", active && "text-brand")} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
