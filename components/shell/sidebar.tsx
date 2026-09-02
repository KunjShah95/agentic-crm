"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  CalendarCheck,
  CheckSquare,
  FileText,
  Handshake,
  KanbanSquare,
  KeyRound,
  MessageSquare,
  Search,
  Settings,
  Share2,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { UserMenu } from "@/components/shell/user-menu"
import { WorkspaceSwitcher, type LiteWorkspace } from "@/components/shell/workspace-switcher"

const NAV = [
  { href: "contacts", label: "Contacts", icon: Users },
  { href: "deals", label: "Deals", icon: KanbanSquare },
  { href: "organizations", label: "Organizations", icon: Building2 },
  { href: "projects", label: "Projects", icon: Building2 },
  { href: "bookings", label: "Bookings", icon: KeyRound },
  { href: "site-visits", label: "Site Visits", icon: CalendarCheck },
  { href: "channel-partners", label: "Channel Partners", icon: Handshake },
  { href: "documents", label: "Documents", icon: FileText },
  { href: "inbox", label: "Inbox", icon: MessageSquare },
  { href: "tasks", label: "Tasks", icon: CheckSquare },
  { href: "search", label: "Search", icon: Search },
]

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
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="p-3">
        <WorkspaceSwitcher active={active} workspaces={memberships} />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={`/${workspace.slug}/${item.href}`}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive(item.href) &&
                "bg-sidebar-accent text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}

        <div className="mt-auto flex flex-col gap-0.5 pt-3">
          <Link
            href={`/${workspace.slug}/settings/social`}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              pathname.includes("/settings/social") &&
                "bg-sidebar-accent text-sidebar-accent-foreground"
            )}
          >
            <Share2 className="size-4" />
            Social
          </Link>
          <Link
            href={`/${workspace.slug}/settings`}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive("settings") && !pathname.includes("/settings/social") && !pathname.includes("/settings/billing") && !pathname.includes("/settings/members") && "bg-sidebar-accent text-sidebar-accent-foreground"
            )}
          >
            <Settings className="size-4" />
            Settings
          </Link>
        </div>
      </nav>

      <div className="flex items-center gap-2 border-t px-3 py-3">
        <UserMenu user={user} workspaceSlug={workspace.slug} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground capitalize">
            {role.toLowerCase()} · {workspace.plan}
          </p>
        </div>
      </div>
    </aside>
  )
}
