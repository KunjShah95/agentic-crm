# Phase 5 — Premium Product Polish

**Date:** 2026-09-28
**Status:** Approved
**Scope:** The app shell, the data surfaces, the feedback states, and the motion
language. Phases 1–4 made the app *consistent*; this phase makes it feel
*finished*. No new tokens, no new colour, no redesign of any module's information
architecture. Direction A and the token system stay locked.

---

## Problem

Phases 1–4 unified the frame: one token layer, one `PageHeader`, one table header,
one card geometry, marketing brought under the same rules. What remains is the
class of defect that consistency alone does not fix — the things a user feels
without being able to name.

| Gap | Evidence | Why it matters |
|---|---|---|
| **Orphaned module** | `documents` is a full page with a live route, but appears in no navigation array | An entire feature is one URL away from existing and completely undiscoverable |
| **Two nav lists** | `sidebar.tsx` and `command-menu.tsx` each held their own hardcoded nav array | The palette listed 4 pages; the sidebar listed 12. Adding a module meant editing two files, so one was missed |
| **11 of 14 routes had no loading state** | No `loading.tsx` on tasks, projects, bookings, reports, settings, documents, ai, association, channel-partners, site-visits, organizations | Every visit to those pages went blank-canvas → content. Users read the blank as a hang |
| **Filters with no pending state** | `contacts-table.tsx` `router.replace` from a debounce with no `useTransition` | Typing in search left the *previous* rows on screen looking authoritative while new ones were in flight, with nothing indicating a fetch was running |
| **Empty state ≠ loaded container** | Contacts/deals rendered empty states bare on the canvas, tables inside `rounded-md border bg-card` | The page visibly resized the first time a filter produced a result |
| **No empty branch at all** | `deals-table.tsx` rendered an empty `<tbody>` plus a totals bar reading "0 deals in view" | A blank grid is a bug report; an empty state is a screen |
| **Every row's `⋯` always visible** | Permanent per-row action buttons in 3 tables | Trains users to scan for buttons instead of reading data, and on a 50-row page that is 50 buttons fighting the content |
| **12 table headers, 3 treatments** | 4 copy-pasted `[&_th]:…` strings, 6 bare, 1 raw `<table>` | The single most visible remaining inconsistency in a data-dense app |
| **Serif card titles** | 32 non-compliant `font-display` uses; `card.tsx` itself was `rounded-xl` + `ring-1` while 25 hand-rolled sites were `rounded-md border` | A 16px Fraunces card title reads as a rendering fault, and two card geometries coexisted |
| **36 raw palette classes in one file** | `follow-up-nudge.tsx` used red/amber/orange × light/dark by hand, while the icon *inside the same box* used `text-status-critical-fg` | Token and palette fighting in one component; 4 palettes to maintain instead of 1 |
| **Mobile double-render** | Both tables rendered the desktop table *and* the mobile card list, neither hidden | Every contact and deal appeared twice on a phone |
| **No route error boundary** | 0 `error.tsx` anywhere in the app tree | A failed render took the whole workspace to Next's error page — losing sidebar, topbar, and place |

---

## Non-goals

- No new modules, no new data model, no schema change
- No marketing changes beyond the `font-mono` markers this phase's test run
  surfaced
- No light/dark re-theming — the tokens are already correct in both modes
- No animation longer than 320ms. This is a dense productivity tool; anything
  past a third of a second charges attention on every navigation

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Nav source of truth | One `nav-config.ts` with grouped sections | Makes an orphaned module impossible rather than merely unlikely |
| Loading states | Composable skeletons, one preset per page archetype | A skeleton is not decoration — it is the proof the click landed, and it must match the final layout or it trades one kind of jank for another |
| Pending feedback | A 2px progress rail above the data region | Keeps rows readable, costs no layout shift, and is unmissable. A spinner or overlay would hide the data the user is still reading |
| Row actions | Hidden until row hover / focus-within; always visible `<sm` | Hover-only would be an a11y bug; `focus-within` is what makes it keyboard-reachable. Touch has no hover, so it is shown below `sm` |
| Table header | One `DataTableHeader` + one `TABLE_HEAD_CLASS` | Deletes the copy-paste that let 4 tables agree and 7 drift |
| Cards | `rounded-md` + hairline border on the primitive, matching the 25 hand-rolled sites | Converging the primitive onto the majority pattern is cheaper and lower-risk than migrating 25 call sites |
| Row entrance | Fade + 4px rise, 22ms stagger, **capped at 8 rows** | Staggering 200 rows would make the last appear 4s late — worse than no animation |
| Empty vs no-match | Two distinct states, never one | Telling someone their first deal does not exist when they typed a bad filter is the most disorienting thing an empty state can do |

---

## 1. Navigation — one source of truth

`components/shell/nav-config.ts` holds `NAV_GROUPS`, `NAV_SETTINGS` and the flat
`SIDEBAR_NAV`. The sidebar, the mobile drawer, and the command palette's "Go to"
list all read it. Groups follow the sales loop, not the alphabet:

```
            Dashboard
Pipeline    Contacts · Organizations · Deals · Brokers
Delivery    Projects · Bookings · Site Visits · Documents
Workspace   Tasks · Reports · AI · Association
            ────────────
            Settings
```

Adds **`documents`** to navigation. `inbox` is deliberately absent — the route is
a `notFound()` stub while the WhatsApp integration is parked, and a nav item that
404s is worse than no nav item.

Two further changes while in the file:

- The workspace name was rendered **twice** in the header (once by the
  switcher, once by a static card below it). The card is gone.
- The switcher is reachable in the **collapsed** rail. It previously vanished,
  stranding anyone who had collapsed the sidebar with no way to change
  workspace.

### Active row

The active item is marked by three channels — fill, weight, icon colour — so it
survives greyscale, low vision, and the collapsed rail where the label is gone
and only the icon remains.

The marker is an **absolutely-positioned 2px rail**, not `border-l-2`. A real
border adds 2px of layout, which shifts every other row's icon on the active
state; the sidebar visibly jumped as you navigated. The absolute rail paints
inside the row's own box instead.

---

## 2. Loading — 14 routes, 4 archetypes

`components/shell/skeletons.tsx` (primitives) + `components/shell/route-skeletons.tsx`
(one preset per archetype) so a route's `loading.tsx` is a single line naming its
shape:

| Preset | Shape | Routes |
|---|---|---|
| `ListModuleLoading` | header + stat band + toolbar + table | contacts, deals(table), tasks, orgs, bookings, site-visits, channel-partners, projects, association |
| `BoardModuleLoading` | header + stat band + columns | deals (kanban) |
| `GridModuleLoading` | header + panel grid | reports, documents, ai |
| `DashboardModuleLoading` | metric band + 3:1 split + activity | dashboard |
| `RecordModuleLoading` | identity + form + side rail | settings |

The skeleton mirrors the real geometry — same header height, same row rhythm,
same column count. A skeleton that does not match the final layout is not a
bridge, it is a second layout the user has to re-read.

`skeleton` animates **opacity only** (compositable, no layout) and is
`infinite alternate` at 1.8s — slow enough to read as a sweep, not a strobe.

---

## 3. Feedback — the pending state

`useTransition` around every URL write in the contacts table, surfaced as a rail
plus an `aria-live` region:

```tsx
const [isNavigating, startNavigation] = React.useTransition()
```

```tsx
<div className="h-0.5 …" aria-hidden>
  <div className={cn("h-full origin-left bg-brand transition-transform",
                     isNavigating ? "scale-x-75" : "scale-x-0")} />
</div>
<span aria-live="polite" className="sr-only">
  {isNavigating ? "Updating contacts" : `${data.total} contacts`}
</span>
```

A rail rather than a spinner because a spinner or overlay hides the rows the
user is still reading, and a 2px bar costs no layout shift. `-mt-4` pulls it into
the gap the container already reserves.

Two secondary wins in the same toolbar:

- `type="search"` on the input, so mobile keyboards offer a search key.
- The Filters button shows a **count** when filters are active. A "Filters"
  button that silently changes the result set, with no indication of whether the
  collapsed panel is doing anything, is the worst version of that control.

---

## 4. Data surfaces

`components/shell/data-surface.tsx` owns the recurring "filter row → bordered
card → totals bar" shape:

- **`DataSurface`** — one container for *both* the empty and loaded branches, so
  the page cannot resize when data first arrives.
- **`DataTableHeader`** — the single `[&_th]:…` treatment, replacing 4 copies
  and 7 deviations. Header rows are `hover:bg-surface-sunken` because a label is
  not a target.
- **`SortableHead`** — `aria-sort` correct, and the caret sits at 0 opacity until
  hover. A permanent caret on every sortable column turns the header into a row
  of competing icons; revealing it still advertises that sorting exists.
- **`RowActions`** — `opacity-0` → `group-hover/row:opacity-100
  focus-within:opacity-100`, and `max-sm:opacity-100`. Both halves matter:
  hover-only is an accessibility bug, and touch has no hover at all.
- **`BulkActionBar`** — the selection mode, once. The brand left edge is the only
  cue that a checkbox did something; without it the bar reads as a third
  toolbar row.
- **`rowEnterStyle(i)`** — returns `undefined` past index 8, so a long table is
  not left visibly incomplete for two seconds.

`SortableHead` also replaced the deals table's four hand-rolled sort buttons,
which had no `aria-sort` at all.

### The mobile double-render bug

Both tables rendered the desktop table **and** the mobile card list, neither
hidden at a breakpoint. The fix is `hidden sm:block` on the table wrapper. This
is the reason `ResponsiveTable` exists; the tables were hand-rolling its job and
getting it wrong.

### Search pending staleness

The async search callback now compares its own query against a ref before
writing state, so a slow response for an abandoned query cannot overwrite newer
results.

---

## 5. Motion language

`app/globals.css` gains three named curves and four durations. Picking from a
named set is what keeps the app feeling like one product rather than a stack of
independently animated screens.

| Token | Value | Job |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | exits, state changes |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0, 0.2, 1)` | reversible (collapse, sheet) |
| `--ease-spring` | `cubic-bezier(0.22, 1, 0.36, 1)` | the one staged entrance |
| `--dur-instant` / `fast` / `base` / `slow` | 100 / 150 / 200 / 320ms | — |

| Class | Animation | Where |
|---|---|---|
| `.animate-rise-in` | fade + 6px rise, 320ms, `backwards` | page entrance, applied to each direct child of the page root in the layout |
| `.animate-row-in` / `fade-in-row` | fade + 4px rise, 200ms | table rows, dashboard activity list |
| `.skeleton` | opacity 0.55↔1, 1.8s alternate | loading states |
| `.theme-switching *` | `transition: none !important` | one frame around a theme swap |

Two details that are load-bearing rather than decorative:

- `animation-fill-mode: backwards` on `rise-in`. Without it the first frame
  paints the element at full opacity and the animation is a no-op. The backwards
  fill is what makes the stagger read as a sequence.
- `.theme-switching` suppression. A theme change repaints background, border,
  colour and shadow on nearly every element at once; without suppression they all
  cross-fade together and the swap smears instead of snapping. `ModeToggle`
  adds the class, forces a reflow, and removes it on the next frame.

`ModeToggle`'s sun/moon cross-fade uses **scale 0.25→1 with a 4px→0 blur**, not a
rotate. Rotating reads as playful; a scale-and-resolve reads as the icon coming
into focus. Both glyphs stay mounted so the exit has a subject.

`prefers-reduced-motion` is handled by the existing global rule, so the new
classes need no per-class guards.

---

## 6. Type and card geometry

**`Card` primitive** — `rounded-xl` + `ring-1 ring-foreground/10` → `rounded-md` +
`border-hairline`, matching the 25 hand-rolled `rounded-md border bg-card`
surfaces. Converging the primitive onto the majority pattern is lower-risk than
migrating 25 call sites, and after this there is one card geometry in the app.

**`CardTitle`** — `text-base font-medium` → `text-[13px] font-semibold`, and the
32 `font-display` overrides in reports, ai, settings, buyer and tag-manager are
removed. Fraunces has exactly two jobs: the page `h1` and stat numerals. A 16px
serif card title is the single most visible remaining typography inconsistency.

**`Badge`** — `rounded-4xl` (neither a token nor a real radius) → `rounded-full`,
and `transition-all` → `transition-colors`.

**`settings/tags` and `association`** — adopted `PageHeader`. Both had hand-rolled
`h1`s at different sizes; the association page's header *changed shape* depending
on whether the user had joined an association, which is the same product
presenting two different pages.

**`font-mono`** — the test surfaced 8 unmarked uses in marketing. Each was
resolved on its merits rather than blanket-marked:

| Site | Verdict |
|---|---|
| `workflows` cost breakdown + total | money → `data-mono="money"` |
| `wins` ₹2.4Cr metric | money → per-item marker |
| `wins` "7 / 10" | count → sans |
| `wins` other 5 metrics | counts → Fraunces numerals |
| `hero` "9:02 AM" | clock label → sans |
| `staff` "Demand notice in 9s" | prose → sans |
| `story` "9:02" | clock label → sans |
| `workflows` step ordinal | label → sans |

The `wins` grid needed a per-item branch because one of six metrics is money and
five are counts. A blanket `data-mono="money"` would have put five counts into
the money typeface and asserted they were amounts.

---

## 7. Status colour

`follow-up-nudge.tsx` is rebuilt around one `NudgePanel` that takes a tone and
derives panel, heading, badge and row tint from it — 36 raw palette classes and
4 light/dark pairs replaced by 4 token references. Adding a fourth severity is
now one line.

`lib/completeness.ts` moves from `bg-red-500` / `text-amber-600 dark:text-amber-400`
to the `--status-*` tokens, and exports a named `CompletenessTone` so call sites
read as severity rather than colour.

`data-health-card`'s bar is now `scaleX` rather than a width percentage, with
`transition-transform`. Animating `width` invalidates layout on every frame;
`transform` does not. The bar also gained `role="meter"` with a value label.

---

## 8. Error containment

Two layers, with different jobs:

- **`app/(app)/[workspace]/error.tsx`** — route-level. Keeps the sidebar, topbar
  and the user's place. `reset()` re-renders the segment; `reload` is the escape
  hatch. Shows the error `digest` when present.
- **`components/ui/error-boundary.tsx`** — inline, per widget. One failing chart
  degrades to a small notice instead of taking the dashboard down. Retry resets
  state in place rather than reloading the page, which the old version did.

---

## 9. React correctness

The compiler lint rejects `setState` in an effect body. Four sites were real
cascading-render problems, not lint noise:

| Component | Was | Now |
|---|---|---|
| `Sidebar` | `useState` + `useEffect(() => setCollapsed(localStorage…))` | `useSyncExternalStore` over localStorage. The sidebar was painting full-width then snapping to 64px for anyone who prefers the rail |
| `MobileNav` | `useEffect(() => setOpen(false), [pathname])` | open state *derived* from the path it was opened at. Closes on browser back/forward too, not just link clicks |
| `CommandMenu` | `useEffect(() => { if (!open) reset() })` + `setSearching(true)` in the search effect | resets in the change handler that causes them. Also fixes stale-response overwrite |
| `ModeToggle` | `useState` + `useEffect(() => setMounted(true))` | `useSyncExternalStore` with an empty subscribe — same hydration guarantee, no extra render pass per mount |

---

---

## Phase 6 — SEO / AEO / GEO

**Date:** 2026-09-28
**Scope:** Keyword strategy, structured data, and the machine-readable surface.
**Status:** Implemented. `tests/unit/marketing-seo.test.ts`, 25 tests.

### The problem

The marketing site had metadata, and none of it agreed with anything else.
`/product` shipped with a `<title>` of literally "Product". `robots.ts` claimed
the AI crawlers were "explicitly allowed" while the wildcard rule above it
disallowed half the site. `llms.txt` and `llms-full.txt` existed as hand-written
markdown that had drifted from the pages they described. And the FAQ answers
lived inside a JSON-LD blob in a component file, where no one editing the pricing
page would ever find them.

Each of these is individually invisible. The page ranks, the rich result renders,
and the model summarises you — just with last quarter's answers.

### Keyword source of truth

`content/marketing.ts` holds one `PageSpec` per route: title, description,
primary term, secondary terms, indexing intent, changefreq, priority.

`pageMetadata({ path })` now resolves everything from it and **throws** on an
unknown path. A marketing route shipping without a keyword spec is a type error
rather than a silent hole that nobody notices for six months.

The home title was rendering as `… — Estate360 | Estate360` because `spec.title`
already carried the brand and the layout template appended it again. Fixed with
`title: { absolute }`.

### Structured data

`components/seo/structured-data.tsx` generates `Organization`,
`SoftwareApplication` (with `AggregateOffer` at all three price points),
`FAQPage` and `BreadcrumbList` from the same arrays the pages render.

The FAQ node and the visible FAQ on `/pricing` read from one array, so the
structured data cannot quote answers the page no longer shows. The pricing FAQ is
rendered in the page body, not only in the JSON-LD — an FAQ that exists solely in
markup is a rule violation with no reader.

**No `aggregateRating`, no testimonials.** There is a test asserting their
absence, because fabricated social proof is the fastest route to a manual action
and the reason a site earns a penalty that outlives the penalty.

### GEO — `llms.txt`

`robots.txt` says whether a crawler may fetch. `sitemap.xml` lists every page.
Neither tells a model *what the product is* or *which page answers which
question*, so a model asked "what CRM should an Ahmedabad builder use" fetches
the homepage, strips the nav, and guesses.

Two generated files, both from `content/`:

| File | Size | Role |
|---|---|---|
| `llms.txt` | 2.6 KB / 341 words | the map — small enough to sit in a context window whole |
| `llms-full.txt` | 6.0 KB / 951 words | the substance — product areas, pricing, full FAQ, contact |

Generated by `scripts/write-llms-txt.ts` into `public/`, wired to `prebuild` and
`npm run seo:llms`. A test asserts the checked-in files match the generator
output, because a stale `llms.txt` is worse than none — a model will cite it
confidently.

**Route handlers were the wrong call and were removed.** Both paths already
existed as static files in `public/`, which is a hard Next build error
(*"a conflicting public file and page file was found"*) and the static file wins
at runtime anyway. The handler looked correct in dev and would have served the
stale copy in production.

### robots.txt

Two rules pulling in opposite directions, both deliberate:

- Search crawlers are kept out of `/*/sites/` and every `/{slug}/{module}` path.
  A builder's inventory, pricing and unit availability are the most commercially
  sensitive thing this product holds; a crawlable tenant tree hands it to a
  competitor.
- AI answer engines (`GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`,
  `Google-Extended`, and 9 more) are **explicitly allowed** over the marketing
  surface. Listed by name rather than relying on the wildcard, because several
  identify as a generic bot and would otherwise be caught by the disallows.

### Sitemap

Built from `PAGES`, so a page cannot be in the sitemap without a title and
description, and cannot be indexed without someone deciding that in the same
file. `/thank-you` is `index: false` — a confirmation page with no content is a
thin-content signal with zero upside. `/login` was already excluded.

### Copy voice

Every marketing string was rewritten to lead with a **mechanism** rather than a
benefit. The test:

```ts
const banned = /\b(seamless(ly)?|revolution(ary|ise)|game[- ]chang(ing|er)|
  cutting[- ]edge|empower(s|ed)?|leverage|robust|world[- ]class|unlock|
  transform your|supercharge|effortless(ly)?)\b/i
```

applies to all page titles, descriptions, FAQ answers, and both `llms` files.
That register is the single most reliable signal that a page was written by a
committee rather than by someone who has used the product — and it correlates
with pages that convert badly, because the reader cannot check any of it.

Before / after, from the product page:

| Before | After |
|---|---|
| "Everything that used to live in Excel, WhatsApp groups, and broker notebooks — workspace-scoped, audited, and built for SG Highway to South Bopal." | "Everything that used to live in a spreadsheet, a WhatsApp group and a broker's notebook — in one workspace, with an audit trail." |
| "GPS site visits — Schedule, check in within 200m, offline field notes. Fake visits die; Site Engineers actually show up on the plot." | "Site visits that prove they happened — Schedule a visit, check in within 200m of the site, capture notes offline. The GPS check is the point: without it, a visit log is a claim rather than a record." |
| "AI next-best-action — Ask the pipeline, draft follow-ups, score enquiries from public sites." | "AI that ranks, not decorates — Next-best-action ordering, follow-up drafting, and enquiry scoring. Every query is workspace-scoped." |

---

## Phase 7 — Demo video

**Script:** `docs/video/demo-script.md`. 3:20, screen capture with VO, seven
shots.

The constraint that shapes it: **every claim on screen is a thing the software
just did.** No stock footage, no logo stinger, no invented metrics, no fabricated
testimonials — a prospect checks those numbers in person, and a demo that fails
verification costs the deal it was meant to win.

The spine is one drag: a deal moves Qualified → Booking, and the cut immediately
to the timeline it just wrote, then to eight payment milestones that existed a
second earlier. Cause and consequence in adjacent shots, not in a montage.

Six of nine capabilities are shown. The three skipped are the ones needing a
screen each and a paragraph of copy to land.

---

## Verification

### Phase 5 — shell and surfaces

- [x] `npx tsc --noEmit` clean
- [x] `npx eslint components app` — 0 errors in app code
- [x] Every route in `NAV_GROUPS` resolves to a real, non-404 page
- [x] `documents` reachable from sidebar, mobile drawer, and ⌘K
- [x] Loading skeleton on all 14 routes
- [x] Contacts/deals/orgs render rows once at 375px
- [x] Row `⋯` hidden until hover, visible on keyboard focus, always visible `<sm`
- [x] Collapsed rail still offers workspace switching
- [x] No `setState` in an effect body across the four shell components
- [ ] Manual pass, light and dark — **not run.** Needs a browser session; the
      desktop browser was not connected, so all visual checks are unverified.

### Phase 6 — SEO / AEO / GEO

- [x] `npx tsc --noEmit` clean
- [x] `npx vitest run tests/unit/marketing-seo.test.ts` — 25 tests
- [x] `npm run seo:llms` — 2.6 KB / 6.0 KB generated
- [x] `/llms.txt` and `/llms-full.txt` both serve 200 from `public/`
- [x] `/robots.txt` and `/sitemap.xml` serve 200
- [x] Every marketing route: unique title, unique description, canonical, JSON-LD
- [x] `/thank-you` emits `noindex`; `/login` absent from the sitemap
- [x] No `aggregateRating` or testimonial node anywhere
- [x] Verified in the running app: homepage carries `SoftwareApplication` +
      `FAQPage`, title renders once, not doubled

### Known failures, not caused by this phase

| Failure | File | Note |
|---|---|---|
| `TS2559: Type 'number' has no properties in common with type 'Partial<Margin>'` | `components/dashboard/charts.tsx:272` | A concurrent writer created this file. Untouched. |
| `token-radius` — 14 arbitrary radii | `charts.tsx`, `projects/project-listing.tsx`, `shell/sidebar.tsx`, `shell/mobile-nav.tsx`, `shell/workspace-switcher.tsx` | Same writer. It is emitting `rounded-[6px]` and hardcoded hex (`border-[#e4e4e4]`, `bg-white`) into files the token system governs. |
| `@next/next/no-html-link-for-pages` ×5 | `app/(marketing)/product/page.tsx:145` | Pre-existing; the file has since been rewritten to use `Button render={<Link/>}`. |
| `@typescript-eslint/no-explicit-any` | `app/api/payments/upi/webhook/route.ts:46` | Pre-existing, unrelated. |

## Risks

| Risk | Mitigation |
|---|---|
| Skeletons drift from real layouts as pages change | Presets live next to the primitives; a page that changes shape should change its preset, and the shared `ListModuleLoading` makes that one edit rather than four |
| Hover-revealed row actions feel hidden | `focus-within` for keyboard, always-on `<sm` for touch, and the `⋯` is the conventional affordance for a row menu |
| Row stagger costs a little on long tables | Capped at 8 rows; past that `rowEnterStyle` returns `undefined` and rows paint immediately |
| `useSyncExternalStore` for the sidebar is unfamiliar | It is the documented tool for reading an external store, and localStorage is exactly that. The same-tab `sidebar:collapse` event is what replaces `setCollapsed` |
| Nav regrouping may surprise existing users | Sections are labelled and ordered by the sales loop; the flat URL space is unchanged, so every bookmark still resolves |
