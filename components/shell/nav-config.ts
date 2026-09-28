import {
  BarChart3,
  Building2,
  CalendarCheck,
  CheckSquare,
  FileText,
  Handshake,
  KanbanSquare,
  KeyRound,
  LayoutDashboard,
  Settings,
  Share2,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** One-word qualifier shown under the label in the mobile drawer. */
  hint?: string
}

export type NavGroup = {
  /** Small uppercase section label. Omitted for the first group. */
  label?: string
  items: NavItem[]
}

/**
 * Single source of truth for workspace navigation.
 *
 * `Sidebar`, `MobileNav` and the command palette all read this array, so a new
 * module becomes reachable the moment it is listed here — there is no second
 * list to keep in sync, which is how `documents` ended up orphaned before.
 *
 * Order encodes the sales loop, not the alphabet: orient, then work the
 * pipeline, then deliver, then run the workspace.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Pipeline",
    items: [
      { href: "contacts", label: "Contacts", icon: Users },
      { href: "organizations", label: "Organizations", icon: Building2 },
      { href: "deals", label: "Deals", icon: KanbanSquare },
      { href: "channel-partners", label: "Brokers", icon: Handshake, hint: "Channel partners" },
    ],
  },
  {
    label: "Delivery",
    items: [
      { href: "projects", label: "Projects", icon: Building2 },
      { href: "bookings", label: "Bookings", icon: KeyRound },
      { href: "site-visits", label: "Site Visits", icon: CalendarCheck },
      { href: "documents", label: "Documents", icon: FileText },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "tasks", label: "Tasks", icon: CheckSquare },
      { href: "reports", label: "Reports", icon: BarChart3 },
      { href: "ai", label: "AI", icon: Sparkles, hint: "Forecasts & scoring" },
      { href: "association", label: "Association", icon: Share2 },
    ],
  },
]

export const NAV_SETTINGS: NavItem = {
  href: "settings",
  label: "Settings",
  icon: Settings,
}

/** Flat list, in visual order. Kept for consumers that only need a sequence. */
export const SIDEBAR_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)
