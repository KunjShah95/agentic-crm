# Phase 3 — Module Content Patterns + Kanban Polish

**Date:** 2026-09-26
**Status:** Approved ("Phase 3 + kanban polish")
**Scope:** Unify content patterns left over after Phases 1–2. No new tokens, no new components, no layout restructuring — Direction A and the token system are locked.

---

## Problem

Phases 1–2 unified the frame (tokens, headers). The module survey shows content patterns are 80% unified from prior work, with four specific gaps. This phase closes them. It is deliberately small — there is no structural redesign because none is needed.

## Non-goals

- No table restructuring, no board restructuring, no form changes
- No changes to `PageHeader`/`Stat`, tokens, or the harness
- Detail-page record-title h1s (`contacts/[id]`, `deals/[id]`, `organizations/[id]`) stay sans — they are record identifiers, not section titles, and 30px Fraunces would over-scale them. If a future pass wants editorial record titles, that is a separate design decision at 24px, not 30px.
- Settings numerals (billing/members/social) stay sans + tabular — they are admin data, not stat-band hero metrics.
- Association empty-state branch stays as-is (edge case, out of the pattern).
- Inbox (disabled), buyer/invite/auth/marketing/public — out of scope.

---

## 1. Stat-band numerals → Fraunces (T2 scope completion)

T2 says Fraunces does two jobs: page `h1` and stat-band numerals. Page headers are done (PageHeader). These stat-band numerals remain sans:

| File:line | Element | Change |
|---|---|---|
| `dashboard/page.tsx:98` | Stat tiles `text-3xl font-semibold tabular-nums` | → `font-display text-[28px] font-medium tracking-[-0.02em] tabular-nums` (keep `mt-3`) |
| `ai/page.tsx:54` | Revenue forecast `text-2xl font-semibold tabular-nums` | → same Fraunces treatment (keep `tabular-nums`) |
| `ai/page.tsx:64` | Collections overdue `text-2xl font-semibold tabular-nums text-destructive` | → same Fraunces treatment (keep `text-destructive`, keep `tabular-nums`) |

Three sites. Nothing else changes on those cards (labels, sub-text, icons all stay).

## 2. Dashboard table header → match the other three tables

`dashboard/page.tsx:138` uses `[&_th]:text-xs` (12px, non-uppercase). The other three tables (contacts, deals, orgs) use `[&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.08em]`.

Change dashboard:138 to the shared treatment verbatim. One line.

## 3. Empty states → shared `ui/empty` component

Only `contacts-table.tsx` and `orgs-table.tsx` use the shared `Empty`/`EmptyTitle`/`EmptyDescription`/`EmptyMedia` from `components/ui/empty.tsx`. Two pages hand-roll:

| File | Current | Change |
|---|---|---|
| `dashboard/page.tsx:127-134` | Hand-rolled pipeline empty state (`size-12 rounded-md bg-muted` icon + title + copy + button) | Rebuild with `Empty`, `EmptyMedia variant="icon"`, `EmptyTitle`, `EmptyDescription`, keeping the identical icon (`KanbanSquare`), title copy, description copy, and CTA button/link |
| `projects/page.tsx:38-45` | Hand-rolled projects empty state (`Card border-dashed` + icon + copy) | Same rebuild with `Building2` icon and identical copy. Keep the surrounding conditional logic; only the empty-state markup changes. |

Copy stays verbatim. Icons stay identical. Only the wrapper components change.

## 4. Kanban polish (refinement, not repair)

`components/deals/kanban-board.tsx` is structurally sound (drag states, empty columns, mobile selector, avatars, tags all work). Four hierarchy refinements:

1. **Value prominence.** Card value is `text-sm font-semibold` (line 251) — same size as the title above it, so price and name compete. Change to `text-[15px] font-semibold` (one step up, still quiet). Title stays `text-sm font-medium`.
2. **Probability badge.** `text-[10px]` (line 255) with default secondary padding reads cramped at 10px. Add `px-1.5 py-px` for breathing room. Do not change the size or variant.
3. **Footer density.** The footer row (line 261: tags + date + avatar, `border-t pt-2`) is correct but the tag dots (`size-2`) + 10px date + 20px avatar create three competing scales. Change tag dots to `size-1.5` so the avatar remains the dominant footer element. Nothing else in the row changes.
4. **Empty column state.** Line 215-219 renders plain muted text ("No deals in this stage yet"). Keep it inline (it lives inside the droppable, so the shared `Empty` component does not fit), but add `border border-dashed rounded-md` to the `<p>` so the drop target reads as a target even when empty. Padding stays `px-2 py-4`.

Do NOT touch: drag/drop logic, stage headers, mobile selector, undo behavior, GripVertical, tag colors, owner avatars, or the `shadow-xs`/`ring-brand` interactive states.

## Rules

- Minimal diffs throughout — change the specified classes/copy, nothing else
- No test changes (conformance suite already covers the result; component tests assert text content, not classes)
- Never edit: `components/ui/**` (except *reading* `empty.tsx` for the correct composition), `components/landing/**`, `app/(marketing)/**`, `app/(public)/**`, `app/api/**`
- Do not fix the pre-existing `.next/types/validator.ts` error
- Do not create documentation files

## Verification

- [ ] Dashboard tiles + ai forecasts render Fraunces numerals — visual check, plus `grep -c "font-display text-\[28px\]"` returns 3+ across those files
- [ ] All four table headers share the identical `TableHeader className`
- [ ] Dashboard + projects empty states use `Empty*` components; copy and CTAs unchanged
- [ ] Kanban: value at 15px, badge padded, dots at 1.5, empty columns dashed-bordered; drag/drop/mobile untouched
- [ ] `npx vitest run` token suites green (6 files, 18 tests) + `inbox-timeline` + `inventory-grid` component tests green
- [ ] `npm run typecheck` clean except the known pre-existing error
- [ ] `npm run build` succeeds

## Risks

| Risk | Mitigation |
|---|---|
| 28px Fraunces on dashboard tiles shifts card heights | Tiles are in a grid; height change is uniform. Accept. |
| `ui/empty` composition differs from hand-rolled spacing | Keep copy/CTA identical; spacing follows the shared component by design. |
| Kanban value at 15px competes with stage totals | Stage totals are 12px muted in the column header; card value at 15px semibold is a clear step below the 28px stat numerals and above 14px titles. Deliberate three-step scale. |
