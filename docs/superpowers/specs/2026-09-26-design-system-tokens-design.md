# Phase 1 — Design System & Tokens

**Date:** 2026-09-26
**Status:** Approved — direction A ("Editorial Warm"), type scope T2
**Scope:** Design tokens and enforcement only. No page layout, shell, or marketing changes.

---

## Problem

The token layer in `app/globals.css` is sound. The problem is that components
bypass it. Three specific failure modes, measured:

| Failure | Evidence |
|---|---|
| Off-token hardcoded values | 18 hardcoded px radii: 14× `rounded-[20px]`, 2× `rounded-[16px]`, 1× `rounded-[4px]`, 1× `rounded-[2px]` |
| Raw palette colors instead of semantic tokens | 65 usages: 21 emerald, 20 amber, 9 red, 6 orange, 5 blue, 3 green, 1 yellow |
| `font-mono` used as UI chrome | 93 usages across ~15 files, mostly badges and 10px labels |
| Global type rule over-reaches | `globals.css:165-169` applies Fraunces to every `h1,h2,h3`; card titles are `<h2 class="text-sm font-semibold">`, so a 14px high-contrast serif renders as "Top pipeline", every section label, every settings tab |
| Page header invented per-page | 11 distinct header shapes across `app/(app)/**/page.tsx` |

The result reads as inconsistent rather than un-designed. This phase makes the
existing direction enforceable so later phases have one frame to inherit.

## Non-goals

- Page layout, sidebar, topbar, or `PageHeader` primitive → **Phase 2**
- Module-level composition (dashboard, contacts, deals, projects, bookings) → **Phase 3**
- Marketing site → **Phase 4**

Phase 1 changes tokens and the rules that consume them. Migrating the 11 page
headers to one primitive happens in Phase 2, not here.

---

## Decisions

| Decision | Choice |
|---|---|
| Direction | A — Editorial Warm (hairline borders over shadows) |
| Fraunces scope | T2 — page `h1` + stat-band numerals only |
| Canvas | Warm `#FBF9F5` (approved; revert to white if it reads beige) |
| Elevation | Hairline borders for static containment; shadows for overlays only |
| Border radius | Collapse 6 steps → 4 |
| Dark mode | Warm ramp mirroring light, not neutral grey |

---

## 1. Type

### Remove the global rule

Delete from `app/globals.css`:

```css
h1, h2, h3 {
  font-family: var(--font-display);
  letter-spacing: -0.025em;
  text-wrap: balance;
}
```

Keep `text-wrap: balance` by moving it to a `.text-balance` utility; drop the
font-family assignment entirely.

### Where Fraunces is allowed

Exactly two contexts, applied deliberately:

1. Page-level `<h1>` — one per screen
2. Stat-band numerals — the large value in a `StatTile`

Everywhere else, Outfit. No exception without a comment explaining why.

### Type scale

| Role | Face | Size / weight | Tracking |
|---|---|---|---|
| Page title (`h1`) | Fraunces | 30px / 500 | -0.025em |
| Stat numeral | Fraunces | 28px / 500 | -0.02em |
| Section title (`h2`) | Outfit | 13px / 600 | 0 |
| Card title (`h4`) | Outfit | 13px / 600 | 0 |
| Body | Outfit | 13px / 400 | 0 |
| Table cell | Outfit | 13px / 400 | 0 |
| Meta / label | Outfit | 11.5px / 500 | 0 |
| Money (tabular) | Outfit | 13px / 500 | 0, `font-variant-numeric: tabular-nums` |

Existing `text-2xl font-display` on page titles becomes the 30px step.
`text-3xl` stat values become the 28px Fraunces step.

### `font-mono` policy

JetBrains Mono is permitted in exactly three cases:

1. Money and numeric identifiers where tabular alignment is load-bearing
2. API keys, tokens, webhook URLs
3. `Settings → API & Webhooks` key display

Every other `font-mono` is chrome and gets removed.

**Scope boundary for this rule.** It applies to `app/(app)/**` and
`components/{shell,dashboard,contacts,deals,settings,ui,property}`. That
directory set currently holds **58** `font-mono` usages. A further **22** live
in `components/landing/**` and `app/(marketing)/**` and are **out of scope** —
Phase 4 decides whether marketing keeps the mono chrome. The 93 figure quoted
earlier in this document is the whole-repo total and is not the Phase 1 target.

## 2. Radius

Replace the six-step scale with four steps. In `globals.css`:

```css
--radius-xs:   4px;    /* pills, tags, dot indicators */
--radius-sm:   6px;    /* buttons, inputs, selects */
--radius-md:   10px;   /* cards, tables, dialogs */
--radius-full: 9999px; /* avatars only */
```

Delete `--radius-lg`, `--radius-xl`, `--radius-2xl`, `--radius-3xl`,
`--radius-4xl` and all derived `--radius-sm/md` calc() indirection.

### Migration map

| Current | Replace with |
|---|---|
| `rounded-[20px]` (14×) | `rounded-md` |
| `rounded-[16px]` (2×) | `rounded-md` |
| `rounded-[4px]`, `rounded-[2px]` | `rounded-xs` |
| `rounded-lg` on cards | `rounded-md` |
| `rounded-xl` on cards/tables | `rounded-md` |
| `rounded-2xl` on cards | `rounded-md` |
| `rounded-full` on pills/badges | keep |
| `rounded-full` on avatars | keep |

After migration, no arbitrary-radius utility (`rounded-[Npx]`) remains in
`app/(app)/**` or `components/**`.

## 3. Semantic status tokens

Replace inline raw-palette pairs with token pairs. Add to `:root` and `.dark`:

```css
--status-positive-bg / --status-positive-fg
--status-caution-bg  / --status-caution-fg
--status-critical-bg / --status-critical-fg
--status-info-bg     / --status-info-fg
--status-neutral-bg  / --status-neutral-fg
```

Light mode, with exact values. Dark mode raises `--surface-raised` one step and
lifts each `fg` lightness to ≥ 0.72 while holding the same hue family:

| Token | `--*-bg` | `--*-fg` | Replaces |
|---|---|---|---|
| positive | `oklch(0.955 0.025 155)` | `oklch(0.52 0.11 155)` | `emerald-500/10` + `emerald-600` |
| caution | `oklch(0.960 0.030 78)` | `oklch(0.55 0.13 68)` | `amber-500/10` + `amber-600` |
| critical | `oklch(0.955 0.022 27)` | `oklch(0.55 0.19 27)` | `red-500/10` + `red-600` |
| info | `oklch(0.955 0.020 245)` | `oklch(0.52 0.12 245)` | `blue-500/10` + `blue-600` |
| neutral | `oklch(0.965 0.004 78)` | `oklch(0.48 0.006 60)` | `slate-*`, `gray-*` |

The `*-bg` values are warm-neutral tints, not saturated washes — this is what
keeps status chips quiet against the warm canvas instead of shouting.

Expose as Tailwind theme entries so components use `text-status-positive-fg`
and `bg-status-positive-bg`.

**Why this matters:** today every dark-mode variant is a hand-written
`dark:text-emerald-400` patch. Centralizing means adding a status color is a
one-line token change instead of an audit across 65 call sites.

**Pipeline stage colors** are user-authored hex from the DB and stay
inline — they are data, not chrome. They render as a dot beside a
neutral-text label, never as the label's text color.

## 4. Surfaces & elevation

```css
--surface-canvas:  oklch(0.988 0.004 82);  /* #FBF9F5 — page background */
--surface-raised:  oklch(0.997 0.002 85);  /* #FDFCFA — cards, tables */
--surface-sunken:  oklch(0.978 0.005 80);  /* #FAF7F2 — table headers, footers */
--hairline:        oklch(0.900 0.006 70);  /* #E7E0D5 — static borders */
```

Dark mode mirrors the same warm ramp at low luminance — the dark canvas is
warm charcoal (`oklch(0.145 0.005 62)`), not neutral grey.

### Elevation policy

- **Static containment** → 1px `--hairline` border. Never a shadow.
- **True overlays** (dialog, dropdown, popover, toast) → `--shadow-e2` / `--shadow-e3`
- `--shadow-e1` is retained for interactive raised states (hover on a card
  that is already bordered) only.

The existing gradient-blob decorations on the contacts page header
(`-top-16 -right-16 … blur-2xl`) are removed. Decorative background gradients
are not part of Direction A.

## 5. Page header convergence (contract only)

Phase 1 does not build the `PageHeader` primitive — Phase 2 does. What Phase 1
does is strip the token-level inconsistencies so Phase 2 starts from one
baseline instead of eleven.

**In Phase 1** (mechanical, per file, no structural change):
- Header container radius → `rounded-md`
- Delete the `relative overflow-hidden` gradient-blob wrappers
- Delete `animate-pulse` status dots in headers
- Page title → 30px Fraunces per the type scale

**Deferred to Phase 2:** building the shared `PageHeader` component, moving the
title/subtitle/action arrangement into it, and collapsing the 11 files down to
one call site. Phase 1 does not add props, slots, or a new component.

---

## Verification

**Type**
- [ ] `grep -r "font-display" app/globals.css` returns nothing
- [ ] Every `<h1>` in `app/(app)/**/page.tsx` uses the page-title class
- [ ] No `<h2 class="text-sm font-semibold">` renders serif
- [ ] `font-mono` count in the Phase 1 scope (`app/(app)/**` + the seven scoped `components/` dirs) drops from 58 to ≤ 12 — money, IDs, and API keys only

**Radius**
- [ ] `grep -rE "rounded-\[[0-9]+px\]" app components` returns nothing
- [ ] No `rounded-lg|xl|2xl|3xl|4xl` on card, table, or dialog containers
- [ ] `--radius-lg` through `--radius-4xl` removed from `globals.css`

**Status**
- [ ] `grep -rE "(emerald|amber|red|blue|green|orange|yellow|slate|violet|rose|indigo|teal|cyan)-(400|500|600|700)" app components` returns zero matches in `app/(app)/**` and scoped components
- [ ] All five status token pairs defined in both `:root` and `.dark`

**Surfaces**
- [ ] Canvas, raised, sunken, hairline tokens defined in both modes
- [ ] No `bg-gradient-to-br` / `blur-2xl` decorative wrappers in `app/(app)/**`
- [ ] `--shadow-e1/e2/e3` still defined; e2/e3 reachable from dialog + dropdown

**Build**
- [ ] `npx tsc --noEmit` clean except the known pre-existing
      `.next/types/validator.ts` error referencing a missing `/today/page.js`
- [ ] `npm run build` succeeds
- [ ] Manual pass in light and dark on: dashboard, contacts, deals, projects,
      bookings, settings — confirm the warm canvas reads as paper, not beige

## Risks

| Risk | Mitigation |
|---|---|
| Warm canvas reads beige against copper | Approved fallback: keep white canvas, warm borders only. Revert is one token. Decide during the manual pass, before Phase 2. |
| 58 `font-mono` removals touch many app files | Scope excludes `components/landing/**` and `app/(marketing)/**`. Phase 4 handles those 22 separately. |
| Status token migration breaks a dark-mode variant | Token pairs defined in both modes up front; verification greps for leftovers. |
| Fraunces numerals inconsistent across stat components | Stat numerals only exist in `StatTile`; Phase 2 makes that the single component. |
