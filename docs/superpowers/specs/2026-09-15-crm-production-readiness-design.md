# Estate360 — Production Readiness Design

**Date:** 2026-09-15
**Status:** Approved
**Scope:** 6 phases to make CRM ready for day-to-day beta use

---

## Phase 1: Form Validation & Duplicate Detection

### 1.1 Required field enforcement

Update Zod schemas in `lib/validators.ts`:

- `contactSchema`: Add refinement requiring at least one of `email` or `phone`
- `dealSchema`: Already requires `title` and `stageId` — no changes needed

### 1.2 Duplicate detection

New server action `checkContactDuplicatesAction(workspaceId, email?, phone?, excludeId?)` in `lib/actions/contacts.ts`:

- Query `db.contact.findMany` with `OR` on lowercase email and phone
- Return matching contacts (id, firstName, lastName, email, phone)
- Call from `createContactAction` and `updateContactAction` before insert/update
- Return duplicates in result so frontend can show warning

### 1.3 Frontend warning

In `components/contacts/contact-form-dialog.tsx`:

- After form submit, if duplicates returned → show inline warning banner
- Banner shows duplicate contacts with "View" link and "Continue anyway" button
- No blocking — user can override

### 1.4 DB constraint

New Prisma migration adding partial unique index:
```sql
CREATE UNIQUE INDEX contact_workspace_email_unique 
ON "Contact" ("workspaceId", LOWER("email")) 
WHERE "email" IS NOT NULL;
```

---

## Phase 2: Bulk Operations on Deals

### 2.1 Server actions

Add to `lib/actions/deals.ts`:

- `bulkMoveDealsAction(workspaceId, dealIds[], stageId)` — moves deals, logs activity per deal
- `bulkAssignDealsAction(workspaceId, dealIds[], ownerId)` — reassigns ownership
- `bulkTagDealsAction(workspaceId, dealIds[], tagIds[])` — tags deals

Add schemas to `lib/validators.ts`:
- `bulkMoveDealsSchema`
- `bulkAssignDealsSchema`
- `bulkTagDealsSchema`

### 2.2 UI

Update `components/deals/deals-table.tsx`:

- Add checkbox column (same pattern as contacts table)
- Add bulk action bar with Stage change, Assign owner, Tag buttons
- Stage change: dropdown dialog with stage selector
- Assign: dropdown dialog with member selector
- Tag: same tag dialog pattern as contacts

---

## Phase 3: Data Completeness Score

### 3.1 Utility

New file `lib/completeness.ts`:

- `contactCompleteness(contact)` → number 0–100
  - Fields: firstName(10), email(20), phone(20), organization(15), jobTitle(10), owner(10), leadSource(10), tags(5)
- `dealCompleteness(deal)` → number 0–100
  - Fields: title(10), contact(20), value(20), stage(10), owner(10), expectedCloseDate(10), dealType(10), probability(10)
- `completenessColor(score)` → "red" | "yellow" | "green"

### 3.2 Display

- Contact detail page: show progress bar in sidebar
- Deal detail page: show progress bar in sidebar
- Contacts table: new optional column (hidden by default)
- Deals table: new optional column (hidden by default)

### 3.3 Dashboard widget

New component `components/dashboard/data-health-card.tsx`:

- Shows average completeness for contacts and deals
- Color-coded bar chart

---

## Phase 4: Activity Reminders & Follow-up Nudges

### 4.1 Dashboard nudge

New component `components/dashboard/follow-up-nudge.tsx`:

- Query: activities where `scheduledAt < now() + 24h` AND `completedAt IS NULL`
- Split into "Overdue" and "Upcoming" sections
- Each item shows: activity type, body preview, contact/deal link, time since/until

### 4.2 Contact detail nudge

In contact detail page sidebar:

- "Last activity X days ago" badge
- Red if > 7 days, yellow if > 3 days, green if recent

### 4.3 Deal detail nudge

In deal detail page sidebar:

- "No activity in X days" badge
- Red if > 3 days (deals go cold fast)

### 4.4 Settings

Add to `app/(app)/[workspace]/settings/page.tsx`:

- "Follow-up thresholds" section
- Contact threshold (default 7 days)
- Deal threshold (default 3 days)
- Stored in `Workspace.settingsJson`

---

## Phase 5: Mobile-Responsive Pass

### 5.1 Table → Card on mobile

New component `components/ui/responsive-table.tsx`:

- Wraps Table components
- On viewport < 640px, renders as stacked cards
- Each card shows: primary field (name/title), key metadata, actions menu

### 5.2 Touch targets

Audit all Button/Link components:

- Add `min-h-[44px] min-w-[44px]` on mobile breakpoints
- Ensure spacing between interactive elements ≥ 8px

### 5.3 Mobile navigation

Update `components/shell/`:

- Bottom nav bar on mobile: Dashboard, Contacts, Deals, More
- Hide sidebar on mobile, show hamburger menu

### 5.4 Forms

Update form dialogs:

- Single-column layout on mobile (grid-cols-2 → grid-cols-1)
- Full-width inputs on mobile

### 5.5 Kanban

Update `components/deals/kanban-board.tsx`:

- Horizontal scroll with snap points on mobile
- Column headers sticky on scroll

---

## Phase 6: Custom Report Builder

### 6.1 Report queries

Add to `modules/reports/queries.ts`:

- `pipelineValueByStage(workspaceId)` — bar chart data
- `dealsByOwner(workspaceId)` — pie chart data
- `collectionsByMonth(workspaceId, startDate, endDate)` — line chart data
- `contactSourceBreakdown(workspaceId)` — pie chart data
- `winRateByDealType(workspaceId)` — table data
- `agentPerformance(workspaceId, dateRange)` — table data

### 6.2 UI

Update `app/(app)/[workspace]/reports/page.tsx`:

- Tab navigation between report types
- Date range picker (last 7d, 30d, 90d, custom)
- Owner/stage filters
- Chart components using CSS-only bar/pie charts (no chart library)
- CSV export button per report
- PDF export via Puppeteer

### 6.3 API

New route `app/api/v1/reports/[type]/route.ts`:

- GET endpoint, authenticated by workspace API key
- Returns JSON report data
- Query params: startDate, endDate, ownerId, stageId

---

## Implementation Order

1. Phase 1 (validation + duplicates) — foundation, no UI dependencies
2. Phase 2 (bulk deal ops) — extends existing pattern
3. Phase 3 (completeness) — computed, no migration
4. Phase 4 (reminders) — query-based, no migration
5. Phase 5 (mobile) — CSS/responsive, no data changes
6. Phase 6 (reports) — builds on existing queries

## Files Modified

| Phase | Files |
|-------|-------|
| 1 | `lib/validators.ts`, `lib/actions/contacts.ts`, `components/contacts/contact-form-dialog.tsx`, new migration |
| 2 | `lib/validators.ts`, `lib/actions/deals.ts`, `components/deals/deals-table.tsx` |
| 3 | new `lib/completeness.ts`, contact detail, deal detail, dashboard |
| 4 | new `components/dashboard/follow-up-nudge.tsx`, contact detail, deal detail, settings |
| 5 | new `components/ui/responsive-table.tsx`, shell, form dialogs, kanban |
| 6 | `modules/reports/queries.ts`, reports page, new API route |
