import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { REPO_ROOT } from "../helpers/source-scan"

/**
 * Phase 5 — structural conformance for the product shell.
 *
 * These rules exist because the defects this phase fixed were not stylistic.
 * Each one was a real, user-visible failure that a linter cannot see:
 *
 *  - a whole module was unreachable because two files each held their own copy
 *    of the nav array and only one was updated
 *  - eleven of fourteen routes painted nothing while their data loaded
 *  - two tables rendered every row twice on a phone
 *  - every table's header had drifted into its own class string
 *  - no route had an error boundary, so one failed render cost the user their
 *    whole workspace
 *
 * They are cheap to assert and expensive to regress, which is exactly the
 * trade worth making in a test.
 */

const APP = path.join(REPO_ROOT, "app/(app)/[workspace]")

function read(rel: string) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8")
}

function exists(rel: string) {
  return fs.existsSync(path.join(REPO_ROOT, rel))
}

/** Every route directory under the workspace tree, excluding dynamic segments. */
function routeDirs(): string[] {
  return fs
    .readdirSync(APP, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("["))
    .map((e) => e.name)
}

describe("navigation", () => {
  const navConfig = read("components/shell/nav-config.ts")

  it("declares a single source of truth for workspace nav", () => {
    expect(exists("components/shell/nav-config.ts")).toBe(true)
    expect(navConfig).toMatch(/export const NAV_GROUPS/)
    expect(navConfig).toMatch(/export const SIDEBAR_NAV/)
  })

  it("is actually consumed by the sidebar, the drawer, and the palette", () => {
    for (const consumer of [
      "components/shell/sidebar.tsx",
      "components/shell/mobile-nav.tsx",
      "components/shell/command-menu.tsx",
    ]) {
      const src = read(consumer)
      expect(src, `${consumer} must not hold its own nav list`).toMatch(
        /from "@\/components\/shell\/nav-config"/
      )
      // A hardcoded href list is the exact pattern that orphaned `documents`.
      expect(src, `${consumer} must not hardcode nav hrefs`).not.toMatch(
        /href:\s*"dashboard"/
      )
    }
  })

  it("routes every declared nav item to a real, non-404 page", () => {
    const hrefs = [...navConfig.matchAll(/href:\s*"([a-z-]+)"/g)].map((m) => m[1])
    expect(hrefs.length).toBeGreaterThan(8)

    for (const href of new Set(hrefs)) {
      const page = path.join(APP, href, "page.tsx")
      expect(exists(path.relative(REPO_ROOT, page)), `/${href} has no page.tsx`).toBe(true)

      // `inbox` is a deliberate `notFound()` stub while WhatsApp is parked.
      // It must not be reintroduced to navigation — a nav item that 404s is
      // worse than no nav item.
      if (href === "inbox") {
        expect(navConfig).not.toMatch(/href:\s*"inbox"/)
      }
    }
  })

  it("groups nav into labelled sections rather than one flat list", () => {
    expect(navConfig).toMatch(/label:\s*"Pipeline"/)
    expect(navConfig).toMatch(/label:\s*"Delivery"/)
  })
})

describe("route feedback", () => {
  it("gives every workspace route a loading state", () => {
    // `inbox` 404s by design and has no data to wait for.
    const missing = routeDirs()
      .filter((d) => d !== "inbox")
      .filter((d) => !exists(`app/(app)/[workspace]/${d}/loading.tsx`))
    expect(missing, "routes with no loading.tsx").toEqual([])
  })

  it("has a route-level error boundary for the workspace", () => {
    expect(exists("app/(app)/[workspace]/error.tsx")).toBe(true)
    const src = read("app/(app)/[workspace]/error.tsx")
    // It must offer both a segment-scoped retry and a full reload: a transient
    // fetch failure and an unrecoverable render are different problems.
    expect(src).toMatch(/reset/)
    expect(src).toMatch(/window\.location\.reload/)
  })

  it("keeps an inline boundary for single widgets, distinct from the route one", () => {
    expect(exists("components/ui/error-boundary.tsx")).toBe(true)
    const src = read("components/ui/error-boundary.tsx")
    expect(src).toMatch(/getDerivedStateFromError/)
  })
})

describe("data surfaces", () => {
  const tables = [
    "components/contacts/contacts-table.tsx",
    "components/deals/deals-table.tsx",
    "components/organizations/orgs-table.tsx",
  ]

  it("renders one table-header treatment, not a per-file copy", () => {
    // The old failure: the same class string pasted into 4 files while 7 more
    // tables used the bare primitive, giving 3 treatments across 11 headers.
    for (const f of tables) {
      expect(read(f), `${f} must use DataTableHeader`).toMatch(/DataTableHeader/)
      expect(
        read(f),
        `${f} has a hand-copied [&_th] header class`
      ).not.toMatch(/\[&_th\]:uppercase/)
    }
  })

  it("renders the empty state inside the same surface as the table", () => {
    // Otherwise the page resizes the first time a filter produces a result.
    for (const f of tables) {
      const src = read(f)
      expect(src, `${f} must render its empty state in a DataSurface`).toMatch(
        /<DataSurface>[\s\S]{0,400}?<EmptyState/
      )
    }
  })

  it("separates 'nothing here yet' from 'nothing matched'", () => {
    for (const f of tables) {
      const src = read(f)
      expect(
        src,
        `${f} conflates the empty and no-match states`
      ).not.toMatch(/EmptyState[^>]*\/>\s*\)\s*:\s*\(\s*<div className="overflow-hidden/)
      // Every table must be able to clear the filters that emptied it.
      expect(src, `${f} offers no way back from an empty filter result`).toMatch(
        /Clear filters|clearAllFilters|clearFilters/
      )
    }
  })

  it("hides the desktop table below sm so rows cannot render twice", () => {
    // Both tables shipped the full table *and* the mobile card list, neither
    // hidden at a breakpoint — every contact and deal appeared twice on a phone.
    for (const f of tables.filter((t) => t.includes("deals") || t.includes("contacts"))) {
      const src = read(f)
      expect(src, `${f} must gate the table at a breakpoint`).toMatch(
        /hidden sm:block"[\s\S]{0,200}?<Table/
      )
    }
  })

  it("reveals row actions on hover and on keyboard focus", () => {
    const src = read("components/shell/data-surface.tsx")
    // Hover-only would make the menu unreachable by keyboard; `max-sm` is
    // because touch devices have no hover at all.
    expect(src).toMatch(/group-hover\/row:opacity-100/)
    expect(src).toMatch(/focus-within:opacity-100/)
    expect(src).toMatch(/max-sm:opacity-100/)
  })

  it("caps the row stagger so long tables are not left visibly incomplete", () => {
    const src = read("components/shell/data-surface.tsx")
    expect(src).toMatch(/if \(index >= 8\) return undefined/)
  })
})

describe("motion", () => {
  it("names its curves and durations instead of hardcoding them per component", () => {
    const sheet = read("app/globals.css")
    for (const token of [
      "--ease-out",
      "--ease-in-out",
      "--ease-spring",
      "--dur-instant",
      "--dur-fast",
      "--dur-base",
      "--dur-slow",
    ]) {
      expect(sheet, `missing motion token ${token}`).toContain(token)
    }
  })

  it("keeps every duration inside the budget for a dense productivity tool", () => {
    const sheet = read("app/globals.css")
    for (const [, raw] of sheet.matchAll(/--dur-[a-z]+:\s*(\d+)ms/g)) {
      expect(Number(raw)).toBeLessThanOrEqual(320)
    }
  })

  it("suppresses transitions across exactly one frame of a theme swap", () => {
    // A theme change repaints background, border, colour and shadow at once.
    // Without suppression the whole page cross-fades and the swap smears.
    const sheet = read("app/globals.css")
    expect(sheet).toMatch(/\.theme-switching/)
    const toggle = read("components/shell/mode-toggle.tsx")
    expect(toggle).toMatch(/classList\.add\("theme-switching"\)/)
    // The reflow is what commits the suppression before a frame can paint.
    expect(toggle).toMatch(/offsetHeight/)
  })

  it("fills the rise-in keyframe backwards so the stagger is visible", () => {
    // Without `backwards` the first frame paints at full opacity and the
    // animation is a no-op.
    const sheet = read("app/globals.css")
    expect(sheet).toMatch(/animation:\s*rise-in[^;]*backwards/)
  })
})

describe("react correctness", () => {
  const sources = [
    "components/shell/sidebar.tsx",
    "components/shell/mobile-nav.tsx",
    "components/shell/command-menu.tsx",
    "components/shell/mode-toggle.tsx",
  ]

  it("has no setState synchronously in an effect body", () => {
    // Each of these was a real cascading render, not lint noise: the sidebar
    // painted full-width before snapping to 64px; the drawer re-rendered on
    // every mount; the palette reset on first render.
    //
    // Matched narrowly — the setState must be the *first* statement in the
    // effect body, which is the pattern the compiler lint flags. A loose
    // "useEffect ... setState" window would flag every async callback and
    // subscription in the file, including the correct ones.
    const body = /useEffect\(\s*(?:async\s*)?\(\)\s*=>\s*\{\s*(?:\/\/[^\n]*\n\s*)*set[A-Z]\w*\(/
    for (const f of sources) {
      expect(read(f), `${f} sets state in an effect body`).not.toMatch(body)
    }
  })

  it("reads the sidebar preference from a store rather than mirroring it", () => {
    const src = read("components/shell/sidebar.tsx")
    expect(src).toMatch(/useSyncExternalStore/)
    expect(src).toMatch(/localStorage/)
  })
})

describe("type scope", () => {
  it("keeps the display serif to page h1 and stat numerals", () => {
    // `font-display` on a card title is the single most visible typography
    // inconsistency in a dense app — a 16px serif reads as a rendering fault.
    for (const f of [
      "app/(app)/[workspace]/reports/page.tsx",
      "app/(app)/[workspace]/ai/page.tsx",
      "components/settings/extended-settings-tabs.tsx",
      "components/settings/tag-manager.tsx",
    ]) {
      const offenders = read(f)
        .split(/\r?\n/)
        .filter((l) => l.includes("font-display") && l.includes("CardTitle"))
      expect(offenders, `${f} renders a CardTitle in the display serif`).toEqual([])
    }
  })

  it("gives the Card primitive the same geometry as the hand-rolled surfaces", () => {
    const src = read("components/ui/card.tsx")
    expect(src).toMatch(/rounded-md/)
    // 25 call sites use `rounded-md border bg-card`; converging the primitive
    // onto the majority pattern is lower-risk than migrating all of them.
    expect(src).not.toMatch(/rounded-xl/)
    expect(src).not.toMatch(/ring-foreground/)
  })
})
