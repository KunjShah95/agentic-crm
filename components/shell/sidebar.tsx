"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  BarChart3,
  Building2,
  CalendarCheck,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  // FileText, // re-enable with the Documents nav item
  Handshake,
  KanbanSquare,
  KeyRound,
  // MessageSquare, // re-enable with the Inbox nav item
  Settings,
  Share2,
  Sparkles,
  Sun,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { WorkspaceSwitcher, type LiteWorkspace } from "@/components/shell/workspace-switcher"

/**
 * Navigation — simplified into everyday sections (master prompt #23).
 * Group labels hide technical entities; every route stays reachable.
 * `group` is only used by the sidebar; SIDEBAR_NAV stays flat for mobile-nav.
 */
const NAV = [
  { href: "today", label: "Today", icon: Sun, group: "Work" },
  { href: "contacts", label: "Leads", icon: Users, group: "Work" },
  { href: "deals", label: "Deals", icon: KanbanSquare, group: "Work" },
  { href: "tasks", label: "Follow-ups", icon: CheckSquare, group: "Actions" },
  { href: "site-visits", label: "Visits", icon: CalendarCheck, group: "Actions" },
  { href: "bookings", label: "Bookings", icon: KeyRound, group: "Sell" },
  { href: "projects", label: "Projects", icon: Building2, group: "Sell" },
  { href: "channel-partners", label: "Brokers", icon: Handshake, group: "Sell" },
  { href: "reports", label: "Reports", icon: BarChart3, group: "Insights" },
  { href: "ai", label: "Assistant", icon: Sparkles, group: "Insights" },
  { href: "organizations", label: "Organizations", icon: Building2, group: "More" },
  { href: "association", label: "Association", icon: Share2, group: "More" },
]

export const SIDEBAR_NAV = NAV

const GROUPS = ["Work", "Actions", "Sell", "Insights", "More"] as const

const COLLAPSE_KEY = "sidebar:collapsed"

export function Sidebar({
  workspace,
  role,
  memberships,
}: {
  workspace: { id: string; slug: string; name: string; plan: string }
  role: string
  memberships: LiteWorkspace[]
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const active = memberships.find((m) => m.id === workspace.id) ?? {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    role,
  }

  // Restore preference after mount (avoids SSR/client mismatch)
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1")
    } catch {
      /* storage unavailable */
    }
  }, [])

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0")
      } catch {
        /* ignore */
      }
      return next
    })
  }

  function isActive(href: string) {
    const current = pathname.split("/")[2]
    return current === href
  }

  return (
    <aside
      className={cn(
        "hidden h-full min-h-0 shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 ease-in-out md:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="shrink-0 p-3">
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mx-auto flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <ChevronsRight className="size-4" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <WorkspaceSwitcher active={active} workspaces={memberships} />
              </div>
              <button
                type="button"
                onClick={toggle}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <ChevronsLeft className="size-4" />
              </button>
            </div>
            <div className="mt-3 hidden items-center gap-2 rounded-lg border bg-card px-2.5 py-2 md:flex">
              <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-[10px] font-bold text-background">
                {workspace.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{workspace.name}</span>
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700 dark:text-emerald-300">LIVE</span>
            </div>
          </>
        )}
      </div>

      <nav className="relative flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        {GROUPS.map((group) => (
          <div key={group} className="mt-0.5 flex flex-col gap-0.5 first:mt-0">
            {!collapsed && (
              <div className="px-2.5 pb-1 pt-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/40">
                {group}
              </div>
            )}
            {NAV.filter((n) => n.group === group).map((item) => {
              const isItemActive = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={`/${workspace.slug}/${item.href}`}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/75 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.98]",
                    collapsed && "justify-center px-0",
                    isItemActive &&
                      "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs border-l-2 border-brand",
                    isItemActive && !collapsed && "pl-2"
                  )}
                >
                  <item.icon className={cn("size-4 shrink-0 transition-colors", isItemActive ? "text-brand" : "text-muted-foreground")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )
            })}
          </div>
        ))}

        <div className="mt-auto flex shrink-0 flex-col gap-1 pt-3 border-t border-sidebar-border/60">
          {/*
            <Link
              href={`/${workspace.slug}/settings/social`}
              title={collapsed ? "WhatsApp" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/75 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.98]",
                collapsed && "justify-center px-0",
                pathname.includes("/settings/social") &&
                  "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs border-l-2 border-brand",
                pathname.includes("/settings/social") && !collapsed && "pl-2"
              )}
            >
              <Share2 className={cn("size-4 shrink-0 transition-colors", pathname.includes("/settings/social") ? "text-brand" : "text-muted-foreground")} />
              {!collapsed && <span>WhatsApp</span>}
            </Link>
          */}
          {/* WhatsApp settings is reachable from Settings → Integrations; re-enable
              the item above (and the Share2 import if it goes stale) to surface it
              in the sidebar again. */}
          <Link
            href={`/${workspace.slug}/settings`}
            title={collapsed ? "Settings" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/75 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.98]",
              collapsed && "justify-center px-0",
              isActive("settings") && !pathname.includes("/settings/billing") && !pathname.includes("/settings/members") &&
                "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs border-l-2 border-brand",
              isActive("settings") && !collapsed && "pl-2"
            )}
          >
            <Settings className={cn("size-4 shrink-0 transition-colors", isActive("settings") ? "text-brand" : "text-muted-foreground")} />
            {!collapsed && <span>Settings</span>}
          </Link>
        </div>
      </nav>
    </aside>
  )
}
