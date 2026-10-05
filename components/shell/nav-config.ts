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
  Library,
  MessagesSquare,
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
      // The inbox is the omnichannel surface over Activity rows — calls, notes,
      // leads and WhatsApp on one timeline. Listed unconditionally rather than
      // gated on WHATSAPP_ENABLED: the route stays live with the WhatsApp channel
      // and composer hidden, so parking the integration hides a tab rather than
      // 404ing a link the nav still advertises.
      { href: "inbox", label: "Inbox", icon: MessagesSquare },
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
      /* Separate from "AI" on purpose. That entry answers from CRM rows; this one
         answers from the workspace's own documents and cites them. Same question
         shape, different corpus, and a user needs to know which one they are
         looking at before they trust the answer. */
      { href: "knowledge", label: "Knowledge base", icon: Library, hint: "Ask your documents" },
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
