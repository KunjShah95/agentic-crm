# Phase 2 — PageHeader Adoption

**Date:** 2026-09-26
**Status:** Approved
**Scope:** Replace hand-rolled page headers with the shared `PageHeader` primitive. No new tokens, no new components, no visual direction changes — Direction A and Phase 1 tokens are locked.

---

## Problem

13 workspace pages hand-roll their headers in 3 different shapes while a to-spec `PageHeader` primitive (`components/shell/page-header.tsx`, fixed in Phase 1 Task 5) sits used by only 2 pages. Every hand-rolled header carries a 22px sans title instead of the 30px Fraunces page title, so the T2 type scope is not actually in effect on most screens.

## Non-goals

- No changes to `PageHeader` or `Stat` themselves (they are to-spec)
- No changes below the header on any page (tables, boards, cards, tabs all untouched)
- Inbox is disabled (404 stub) — out of scope
- `app/buyer`, `app/invite`, `app/(auth)`, `app/(marketing)`, `app/(public)` — out of scope (not workspace shell)

---

## Slot mapping

`PageHeader` accepts `title`, `description`, `badge`, `actions`, `stats`, `className`. Every adoption maps the existing header content into these slots and deletes the hand-rolled container. The title automatically becomes 30px Fraunces; no per-page title styling remains.

| Page | Title | Description (keep verbatim unless noted) | Badge / Actions | Stats | Notes |
|---|---|---|---|---|---|
| `bookings` | Bookings | keep | — | — | Simplest adoption. Delete container only. |
| `channel-partners` | Brokers (keep — do not rename) | `{cps.length} partners · {commissions.length} commissions` — **drop the trailing "CP scope via brokerScopeFilter"** (dev jargon, meaningless to agents) | actions: `<BrokerToolbar>` (admin-only conditional stays) | — | — |
| `contacts` | Contacts | keep | actions: org/member pills move here unchanged, **minus the `animate-pulse` dot** on the emerald indicator (Phase 1 spec item that slipped through Task 4) | — | Pills keep `hidden sm:inline-flex` responsive behavior. |
| `deals` | Deals | keep | actions: view toggle + `<StageManager>` + `<DealFormDialog>`, moved verbatim | stats: the 4 stat cards become `<Stat>` components; `<CompanyTakeCard>` stays embedded in the stats slot as-is (it is a `ReactNode` child, not a `Stat`) | Most complex adoption. Do not restyle the toggle, dialogs, or take card. |
| `documents` | Documents | keep | — | — | — |
| `organizations` | Organizations | keep | actions: `<OrgFormDialog>` | — | — |
| `reports` | Reports | keep | actions: `<ExportButtons>` | — | Already `font-display` 24px; PageHeader takes it to 30px. Remove the orphaned `relative overflow-hidden` (no decoration remains). |
| `settings` | Workspace Settings | keep | badge: plan `<Badge>` (keep `bg-brand` styling) | — | Keep the `max-w-4xl` outer wrapper — settings is narrower than other pages by design. Remove orphaned `relative overflow-hidden`. |
| `site-visits` | Site Visits | keep | actions: `<ScheduleVisitDialog>` | — | — |
| `tasks` | My Tasks (keep — do not rename) | keep | actions: `<NewTaskDialog>` | — | — |
| `dashboard` | Dashboard | keep | badge: workspace-name badge (currently `font-mono` — Task 3 stripped mono from badges; if it remains here, drop it); actions: "Go to contacts" + "Reports" buttons moved verbatim | — | Currently a bare flex header (no card). Gains the card container. |
| `ai` | Intelligence (keep) | keep | — | — | Currently bare with a `<Bot>` icon inline in the title. `PageHeader` title accepts `ReactNode`, so pass the icon inline unchanged. Do not invent an icon slot. |
| `association` | `{association.name}` (keep dynamic) | keep | badge: slug `<Badge>`; actions: member-count `<Badge>` moved as-is | — | Currently bare. Title stays dynamic. |

## Rules

- The hand-rolled container (`rounded-md border bg-card p-5 md:p-6` + inner flex wrapper) is deleted in every adoption. Nothing else on the page is touched.
- Descriptions stay verbatim except channel-partners (jargon cut specified above).
- Dialogs, toggles, toolbars, and cards move verbatim — no restyling, no prop changes.
- `Stat` prop signature is unchanged; the deals stats map label/value/sub directly.
- Unused imports left behind by deleted containers (e.g. `cn`, `Card`) are cleared.
- No test changes — the conformance suite already covers the result (radius, type, surfaces). If an adoption introduces a banned pattern, the suite fails and the implementer fixes it.

## Verification

- [ ] All 13 pages render their header through `<PageHeader>` — `grep -r "from \"@/components/shell/page-header\"" app/\(app\)` returns 15 files (13 new + 2 existing)
- [ ] No hand-rolled header container remains — `grep -rE "rounded-md border bg-card p-5" app/\(app\)/**/page.tsx` returns only non-header matches (e.g. project cards)
- [ ] No `text-[22px]` title remains in `app/(app)/**/page.tsx`
- [ ] No `animate-pulse` remains in `contacts/page.tsx`
- [ ] No "brokerScopeFilter" string remains in `channel-partners/page.tsx`
- [ ] `npx vitest run` token suites green (6 files, 18 tests)
- [ ] `npm run typecheck` clean except the known pre-existing error
- [ ] `npm run build` succeeds
- [ ] Manual pass on all 13 pages confirming identical content with the new frame

## Risks

| Risk | Mitigation |
|---|---|
| Deals header is the most complex (toggle + 2 dialogs + stats + take card) | Mapped explicitly above; slots accept arbitrary `ReactNode` so nothing needs restructuring |
| Settings `max-w-4xl` vs standard width | Kept deliberately — documented in the mapping, not an oversight |
| Channel-partners title "Brokers" vs route "channel-partners" | Kept deliberately — renaming is a product decision, out of scope |
