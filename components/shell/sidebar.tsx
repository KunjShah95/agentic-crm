"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore } from "react"
import { ChevronsLeft, ChevronsRight, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Logo, LogoMark } from "@/components/ds/logo"
import { WorkspaceSwitcher, type LiteWorkspace } from "@/components/shell/workspace-switcher"
import { NAV_GROUPS, NAV_SETTINGS, type NavItem } from "@/components/shell/nav-config"

const COLLAPSE_KEY = "sidebar:collapsed"

/**
 * localStorage as a React store.
 *
 * `getSnapshot` must return a cached value for a given store state or React
 * loops forever, so the parsed boolean is memoised in a module-level slot and
 * only recomputed when the raw string actually changes.
 */
let cachedRaw: string | null = null
let cachedValue = false

function readCollapsed() {
  const raw = localStorage.getItem(COLLAPSE_KEY)
  if (raw === cachedRaw) return cachedValue
  cachedRaw = raw
  cachedValue = raw === "1"
  return cachedValue
}

/**
 * The `storage` event only fires in *other* tabs, so the same-tab `storage`
 * event is dispatched manually by the writer. Both paths notify, which keeps
 * two open tabs of the workspace in agreement.
 */
function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener("sidebar:collapse", onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener("sidebar:collapse", onChange)
  }
}

/** Settings owns its own subtree, so the highlight must be section-aware. */
function isSettingsSection(pathname: string) {
  return pathname.split("/")[2] === "settings"
}

/**
 * One navigation row.
 *
 * The icon is not decoration here — on a rail this dark, an icon at 45% white
 * is the only thing that makes a row scannable at a glance, so the icon leads
 * and carries the most state change of the three channels:
 *
 *   rest   icon white/45, label white/65, no fill
 *   hover  icon white/75, label white, fill white/[0.06]
 *   active icon white,    label white,  fill white/[0.11] + a 2px white rail
 *
 * The active marker is an absolutely-positioned rail rather than a border, for
 * the same reason the old one was: a real border adds 2px of layout, which
 * shifts every other row's icon as you navigate and makes the rail visibly
 * jump. Painted inside the row's own box, it costs nothing.
 */
function NavRow({
  item,
  active,
  collapsed,
  href,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  href: string
}) {
  return (
    <Link
      href={href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-[34px] items-center gap-2.5 rounded-sm pr-2.5",
        "text-[13px] leading-5 tracking-[-0.011em]",
        // Named properties only. `transition-colors` and never `transition-all`
        // — the row has no transform to animate and a blanket transition
        // re-triggers on unrelated paints, which shows up as a laggy rail.
        "transition-colors duration-150",
        collapsed ? "justify-center px-0" : "pl-3",
        active
          ? "bg-white/[0.11] font-bold text-white"
          : "font-normal text-white/60 hover:bg-white/[0.06] hover:text-white"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-[7px] left-0 w-[2px] rounded-full bg-white",
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
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}

/** The 34px-tall trigger that collapses the rail. Sits bottom-right, not in a header. */
function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const Icon = collapsed ? ChevronsRight : ChevronsLeft
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-sm text-white/40",
        "transition-colors duration-150 hover:bg-white/10 hover:text-white",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      )}
    >
      <Icon className="size-4" strokeWidth={1.7} />
    </button>
  )
}

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
  const activeWorkspace = memberships.find((m) => m.id === workspace.id) ?? {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    role,
  }

  /*
   * The collapsed preference is read straight from localStorage through
   * `useSyncExternalStore`, not mirrored into state by an effect. `useState` +
   * `useEffect(setState)` is a setState in an effect body: an extra render pass
   * on every mount, and a visible snap from 240px to 64px for anyone who
   * prefers the rail. localStorage *is* an external store, so this is the tool.
   */
  const collapsed = useSyncExternalStore(subscribeToStorage, readCollapsed, () => false)

  function toggle() {
    const next = !collapsed
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0")
    } catch {
      /* storage unavailable — the preference just will not persist */
    }
    // The write above is invisible to same-tab subscribers, so notify them.
    window.dispatchEvent(new Event("sidebar:collapse"))
  }

  function isActive(href: string) {
    return pathname.split("/")[2] === href
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "hidden h-full min-h-0 shrink-0 flex-col bg-sidebar md:flex",
        collapsed ? "w-[60px]" : "w-[232px]",
        "transition-[width] duration-200 ease-in-out motion-reduce:transition-none"
      )}
    >
      {/* Masthead: the logo, then the workspace. The logo is the only element
          in the app that names the product, so it gets its own band above the
          workspace control rather than competing with it in one row. */}
      <div
        className={cn(
          "flex h-[52px] shrink-0 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-0" : "gap-1 px-3"
        )}
      >
        <Link
          href={`/${workspace.slug}/dashboard`}
          className="min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label="Estate360 dashboard"
        >
          {collapsed ? <LogoMark /> : <Logo />}
        </Link>
        {!collapsed && (
          <div className="ml-auto">
            <CollapseToggle collapsed={collapsed} onToggle={toggle} />
          </div>
        )}
      </div>

      {/* Workspace control. Sits directly under the logo so the rail reads top
          to bottom as: product → workspace → where you can go. */}
      <div className={cn("shrink-0 py-2", collapsed ? "px-2" : "px-3")}>
        <WorkspaceSwitcher
          active={activeWorkspace}
          workspaces={memberships}
          compact={collapsed}
          onRail
        />
      </div>

      <nav
        aria-label="Workspace"
        className="relative flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden py-1"
        style={{ paddingInline: collapsed ? 8 : 12 }}
      >
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label ?? `group-${gi}`} className={gi > 0 ? "mt-4" : undefined}>
            {group.label && !collapsed ? (
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-white/30">
                {group.label}
              </p>
            ) : gi > 0 && collapsed ? (
              // Rail mode still needs the group boundaries or the icons read as
              // one undifferentiated column — a hairline does it without
              // spending the horizontal pixels a label would.
              <div aria-hidden className="mx-auto mb-1.5 mt-3 h-px w-5 bg-white/12" />
            ) : null}
            <div className="flex flex-col gap-[2px]">
              {group.items.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                  collapsed={collapsed}
                  href={`/${workspace.slug}/${item.href}`}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="mt-auto pt-3">
          {collapsed && (
            <div className="mb-1.5 flex justify-center">
              <CollapseToggle collapsed={collapsed} onToggle={toggle} />
            </div>
          )}
          <NavRow
            item={NAV_SETTINGS}
            active={isSettingsSection(pathname)}
            collapsed={collapsed}
            href={`/${workspace.slug}/settings`}
          />
        </div>
      </nav>

      {/* Rail footer. Only in the expanded state — in the rail the collapse
          toggle moves to the nav's own tail, so a footer would be a second copy
          of the same control. */}
      {!collapsed && (
        <div className="shrink-0 border-t border-sidebar-border px-3 py-2.5">
          <Link
            href={`/${workspace.slug}/contacts`}
            className={cn(
              "flex h-8 items-center gap-2 rounded-sm px-2.5 text-[12.5px] font-bold",
              "text-white/70 transition-colors duration-150",
              "hover:bg-white/10 hover:text-white",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            )}
          >
            <Plus className="size-4 shrink-0" strokeWidth={2} />
            Add a contact
          </Link>
        </div>
      )}
    </aside>
  )
}
