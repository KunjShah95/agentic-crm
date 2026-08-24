# Phase 1 Gap Closure — 2026-08-09

## Gaps identified from spec `2026-08-07-agentic-crm-phase1-design.md`

| # | Spec section | Gap before 08-09 | Resolution |
|---|--------------|------------------|------------|
| 1 | Search — Postgres full-text `tsvector` | Inline `to_tsvector` without stored column or GIN index; no ranking | Added migration `20260809000001_search_tsvector` with stored `searchVector` columns, GIN indexes, weighted triggers, backfill; updated `modules/search/queries.ts:25` to use `COALESCE(searchVector, to_tsvector(...))` + `ts_rank` ordering with fallback |
| 2 | Activities — `TASK` assignee | `assigneeId` hardcoded to `session.user.id` `lib/actions/activities.ts:51`; no UI to assign | Added `assigneeId` to `activitySchema` `lib/validators.ts:80`, server validation against `WorkspaceMember` `lib/actions/activities.ts:42`, composer select `components/activities/activity-composer.tsx:68` wired via `members` prop; pages `app/(app)/[workspace]/contacts/[id]/page.tsx:293` and `deals/[id]/page.tsx:216` pass members |
| 3 | Deals — stage ordering | `order` auto-increment only `lib/actions/deals.ts:196`; no drag-reorder | Added `reorderStagesSchema` `lib/validators.ts:73`, `reorderStagesAction` with OFFSET two-pass to avoid `(workspaceId,order)` unique collision `lib/actions/deals.ts:260`, drag-reorder UI in `components/deals/stage-manager.tsx:119` via `@hello-pangea/dnd` |
| 4 | Testing Strategy | No tests; `package.json` had no `test` scripts | Scaffolded `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`; unit tests `tests/unit/{permissions,format,validators,stage-order}.test.ts` (29 tests); integration harness `tests/integration/db.test.ts` (workspace-isolation, skipped without real DB); E2E `tests/e2e/crm.spec.ts` (signup/invite/search/deals); added npm scripts `test`, `test:coverage`, `test:e2e`; made `lib/db.ts:6` VITEST-safe |

## Verification

- `npx tsc --noEmit` — clean (fixed `lib/db.ts:12` any cast, `tests/integration/db.test.ts:54` lastName)
- `npx vitest run` — 29 passed, 2 skipped (integration without real DB), 4 suites
- `npm run build` — compiled 1668ms, 13 dynamic routes, no type errors
- Prisma — `prisma validate` valid; new migration `prisma/migrations/20260809000001_search_tsvector/migration.sql` ready for `prisma migrate dev` (requires live DB)

## Remaining / intentional

- Out-of-scope per spec (AI agents, email/calendar, billing) — not implemented.
- Integration/E2E against real DB remain skipped in CI without `DATABASE_URL`; unit suite covers pure functions, validators, stage-order, permission matrix.
