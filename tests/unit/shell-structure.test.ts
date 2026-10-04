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
    }
  })

  it("does not put a notFound() stub back into navigation", () => {
    // `inbox` was a deliberate `notFound()` stub while WhatsApp was parked, and
    // the nav item was removed with it. A nav item that 404s is worse than no
    // nav item, so this asserts the stub is gone rather than re-adding an
    // exclusion for whichever route happens to be disabled today: parking a
    // module should hide its tab, not leave a dead link advertised.
    const stubbed = routeDirs().filter((dir) => {
      const file = `app/(app)/[workspace]/${dir}/page.tsx`
      if (!exists(file)) return false
      const src = read(file)
      return /export default function \w+\(\)\s*\{\s*notFound\(\)/.test(src)
    })
    for (const dir of stubbed) {
      expect(navConfig, `/${dir} is a notFound() stub but is in the nav`).not.toMatch(
        new RegExp(`href:\\s*"${dir}"`),
      )
    }
  })

  it("groups nav into labelled sections rather than one flat list", () => {
    expect(navConfig).toMatch(/label:\s*"Pipeline"/)
    expect(navConfig).toMatch(/label:\s*"Delivery"/)
  })
})

describe("route feedback", () => {
  it("gives every workspace route a loading state", () => {
    // Settings is one segment with several sub-routes (`settings/members`,
    // `settings/social`, …) sharing the parent boundary, so the parent
    // `loading.tsx` covers them. `routeDirs()` only reads top-level directories,
    // so sub-routes never appear in this list and need no file of their own.
    const missing = routeDirs().filter((d) => !exists(`app/(app)/[workspace]/${d}/loading.tsx`))
    expect(missing, "routes with no loading.tsx").toEqual([])
  })

  it("restores a parked integration without leaving a notFound() stub behind", () => {
    // WhatsApp was parked by commenting out two routes into `notFound()` stubs
    // (`inbox` and `settings/social`) and removing the nav entry. The stubs were
    // the trap: restoring the route meant deleting them, and leaving one behind
    // would 404 a link the nav advertises. This asserts the restored shape so the
    // next park/unpark does not have to rediscover it.
    expect(exists("app/(app)/[workspace]/inbox/page.tsx")).toBe(true)
    expect(exists("app/(app)/[workspace]/settings/social/page.tsx")).toBe(true)

    for (const rel of [
      "app/(app)/[workspace]/inbox/page.tsx",
      "app/(app)/[workspace]/settings/social/page.tsx",
    ]) {
      const src = read(rel)
      expect(src, `${rel} is still a notFound() stub`).not.toMatch(
        /ROUTE DISABLED|ORIGINAL IMPLEMENTATION \(disabled\)/,
      )
      expect(src, `${rel} must be an async server component`).toMatch(/export default async function/)
    }
  })

  it("keeps the WhatsApp master switch as the single gate on the integration", () => {
    // Both restored routes are reachable while `WHATSAPP_ENABLED` is false — the
    // switch hides the WhatsApp surface inside them rather than 404ing the route.
    // That inversion is deliberate (the inbox is the omnichannel timeline, useful
    // with or without WhatsApp) so it needs pinning: the alternative reading is
    // "parked means unroutable", which reintroduces dead nav links.
    const inbox = read("app/(app)/[workspace]/inbox/page.tsx")
    expect(inbox).toMatch(/whatsappEnabled\(\)/)
    expect(inbox).toMatch(/waOn && selected && replyContext/)

    const settings = read("app/(app)/[workspace]/settings/social/page.tsx")
    expect(settings).toMatch(/if \(!whatsappEnabled\(\)\)/)
  })

  it("gates every WhatsApp entry point on one helper, not scattered env reads", () => {
    // The risk of an env-gated integration is drift: a second `process.env
    // .WHATSAPP_ENABLED` read somewhere new is a path that disagrees with the
    // master switch. So the rule is structural — the switch is read through
    // `whatsappEnabled()` and nowhere else.
    const roots = ["app", "components", "lib", "modules"]
    const files: string[] = []
    for (const root of roots) {
      const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.name === "node_modules" || e.name.startsWith(".")) continue
          const full = path.join(dir, e.name)
          if (e.isDirectory()) walk(full)
          else if (/\.tsx?$/.test(e.name)) files.push(full)
        }
      }
      walk(path.join(REPO_ROOT, root))
    }

    // Bracket and optional-chain forms included deliberately. `process.env?.X` and
    // `process.env["X"]` are both real shapes at a call site and both bypass the
    // master switch as effectively as the plain read — an earlier version of this
    // regex missed all three and would have reported a clean codebase while a
    // bypass sat in it. `WHATSAPP_TOKEN` must NOT match, or the guard is useless.
    const DIRECT_ENV_READ =
      /process\.env(?:\?\.|\.|\[)\s*\(?\s*["']?WHATSAPP_ENABLED\b/
    const direct = files.filter((f) => {
      const rel = f.replace(/\\/g, "/")
      if (rel.includes("modules/whatsapp/config")) return false
      return DIRECT_ENV_READ.test(fs.readFileSync(f, "utf8"))
    })
    expect(
      direct.map((f) => path.relative(REPO_ROOT, f)),
      "WHATSAPP_ENABLED must only be read in modules/whatsapp/config",
    ).toEqual([])
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
