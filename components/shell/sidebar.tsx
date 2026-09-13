"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Building2,
  CalendarCheck,
  CheckSquare,
  // FileText, // re-enable with the Documents nav item
  Handshake,
  KanbanSquare,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Share2,
  Sparkles,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { UserMenu } from "@/components/shell/user-menu"
import { WorkspaceSwitcher, type LiteWorkspace } from "@/components/shell/workspace-switcher"

const NAV = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "contacts", label: "Contacts", icon: Users },
  { href: "deals", label: "Deals", icon: KanbanSquare },
  { href: "organizations", label: "Organizations", icon: Building2 },
  { href: "projects", label: "Projects", icon: Building2 },
  { href: "bookings", label: "Bookings", icon: KeyRound },
  { href: "site-visits", label: "Site Visits", icon: CalendarCheck },
  { href: "channel-partners", label: "Brokers", icon: Handshake },
  // { href: "documents", label: "Documents", icon: FileText },
  { href: "inbox", label: "Inbox", icon: MessageSquare },
  { href: "tasks", label: "Tasks", icon: CheckSquare },
  { href: "reports", label: "Reports", icon: BarChart3 },
  { href: "ai", label: "AI", icon: Sparkles },
  { href: "association", label: "Association", icon: Share2 },
]

export const SIDEBAR_NAV = NAV

export function Sidebar({
  workspace,
  role,
  memberships,
  user,
}: {
  workspace: { id: string; slug: string; name: string; plan: string }
  role: string
  memberships: LiteWorkspace[]
  user: { id: string; name: string; email: string; image?: string | null }
}) {
  const pathname = usePathname()
  const active = memberships.find((m) => m.id === workspace.id) ?? {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    role,
  }

  function isActive(href: string) {
    const current = pathname.split("/")[2]
    return current === href
  }

  return (
    <aside className="hidden h-full min-h-0 w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="shrink-0 p-3">
        <WorkspaceSwitcher active={active} workspaces={memberships} />
        <div className="mt-3 hidden items-center gap-2 rounded-lg border bg-card px-2.5 py-2 md:flex">
          <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-[10px] font-bold text-background">
            {workspace.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{workspace.name}</span>
          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700 dark:text-emerald-300">LIVE</span>
        </div>
      </div>

      <nav className="relative flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {NAV.map((item) => {
          const isItemActive = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={`/${workspace.slug}/${item.href}`}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/75 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.98]",
                isItemActive &&
                  "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs border-l-2 border-brand pl-2"
              )}
            >
              <item.icon className={cn("size-4 shrink-0 transition-colors", isItemActive ? "text-brand" : "text-muted-foreground")} />
              <span>{item.label}</span>
            </Link>
          )
        })}

        <div className="mt-auto flex shrink-0 flex-col gap-1 pt-3 border-t border-sidebar-border/60">
          <Link
            href={`/${workspace.slug}/settings/social`}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/75 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.98]",
              pathname.includes("/settings/social") &&
                "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs border-l-2 border-brand pl-2"
            )}
          >
            <Share2 className={cn("size-4 shrink-0 transition-colors", pathname.includes("/settings/social") ? "text-brand" : "text-muted-foreground")} />
            <span>Social</span>
          </Link>
          <Link
            href={`/${workspace.slug}/settings`}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/75 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.98]",
              isActive("settings") && !pathname.includes("/settings/social") && !pathname.includes("/settings/billing") && !pathname.includes("/settings/members") && "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs border-l-2 border-brand pl-2"
            )}
          >
            <Settings className={cn("size-4 shrink-0 transition-colors", isActive("settings") && !pathname.includes("/settings/social") ? "text-brand" : "text-muted-foreground")} />
            <span>Settings</span>
          </Link>
        </div>
      </nav>

      <div className="flex shrink-0 items-center justify-between border-t border-sidebar-border/60 px-3 py-3">
        <UserMenu user={user} workspaceSlug={workspace.slug} />
      </div>
    </aside>
  )
}
