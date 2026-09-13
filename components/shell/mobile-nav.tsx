"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Settings, Share2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { SIDEBAR_NAV } from "@/components/shell/sidebar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function MobileNav({
  workspaceSlug,
  workspaceName,
}: {
  workspaceSlug: string
  workspaceName: string
}) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  // Close drawer on navigation
  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  function isActive(href: string) {
    return pathname.split("/")[2] === href
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open navigation menu"
        className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
      >
        <Menu className="size-4" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="border-b p-3 text-left">
          <SheetTitle className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-[10px] font-bold text-background">
              {workspaceName.slice(0, 2).toUpperCase()}
            </span>
            <span className="truncate text-sm">{workspaceName}</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
          {SIDEBAR_NAV.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={`/${workspaceSlug}/${item.href}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active &&
                    "bg-sidebar-accent text-sidebar-accent-foreground font-semibold border-l-2 border-brand pl-2"
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-brand" : "text-muted-foreground"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
          <div className="mt-auto flex flex-col gap-1 border-t border-sidebar-border/60 pt-3">
            <Link
              href={`/${workspaceSlug}/settings/social`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent"
            >
              <Share2 className="size-4 shrink-0 text-muted-foreground" />
              <span>Social</span>
            </Link>
            <Link
              href={`/${workspaceSlug}/settings`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent"
            >
              <Settings className="size-4 shrink-0 text-muted-foreground" />
              <span>Settings</span>
            </Link>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
