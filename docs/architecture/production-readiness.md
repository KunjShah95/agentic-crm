# Estate360 — Production Readiness Checklist

**Updated:** 2026-10-03. Status of what's done vs. what must happen before go-live.

---

## Done in this pass

- [x] **Real RERA document templates** seeded — Demand Letter, Allotment, Booking Form, Receipt, Possession (`prisma/seed.ts`). Replaces the previously empty/placeholder Documents page.
- [x] **Real-estate demo data** — "Skyline Residences" (Ahmedabad, RERA no.), Tower A, floor 12, unit A-1204 (3BHK), cost sheet, booked deal, and one pre-generated Allotment Letter so the Documents page shows real content out of the box.
- [x] **Real PDF download** — headless-Chromium renderer (`lib/pdf.ts`, `puppeteer-core` + `@sparticuz/chromium`):
  - Documents: `GET /[workspace]/documents/[id]/pdf` → styled A4 PDF, "Download PDF" button on each doc card.
  - Reports: `?format=pdf` on the reports export route + PDF/Excel buttons in the reports UI.
- [x] **`.env.example`** documents `PUPPETEER_EXECUTABLE_PATH` for local dev.

## WhatsApp integration status

The integration is **parked by an env switch, not removed**. `WHATSAPP_ENABLED`
defaults to `"false"`, and that one flag gates every entry point: the settings UI,
the inbound webhook, the drain cron, and outbound send.

Routes are **live regardless of the switch**, which is the part worth knowing:

| Route | When `WHATSAPP_ENABLED=false` |
| --- | --- |
| `/<slug>/inbox` | Renders. The inbox is the omnichannel `Activity` timeline — calls, notes, leads and WhatsApp on one view — so it stays useful with WhatsApp off. The WhatsApp channel filter and the reply composer are hidden, and `?channel=WHATSAPP` degrades to "all". |
| `/<slug>/settings/social` | Renders an "integration is currently disabled" notice with a link back to settings. The connection panel is not rendered. |

Both routes were `notFound()` stubs while parked. They are now restored, and
`tests/unit/shell-structure.test.ts` asserts that a restored route is not a stub
and that no nav item points at one — parking a module should hide its tab, not
leave a dead link in the sidebar.

`Inbox` was re-added to `NAV_GROUPS` (Pipeline). `Sidebar`, `MobileNav` and the
command palette all read that one array, so there is no second list to update.

To re-enable: set `WHATSAPP_ENABLED="true"` and fill in `WHATSAPP_APP_ID`,
`WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`. The panel's readiness check
lists whatever is still missing. Inbound verification fails closed until
`WHATSAPP_VERIFY_TOKEN` is set — see `docs/whatsapp-setup.md`.

Broker scoping applies to the inbox reads *and* to outbound send: a BROKER only
sees, and can only message, contacts attached to their own deals. See
`docs/security/open-findings.md`.

## Search (2026-10-03)

Search was broken four ways at once, and three of them were invisible to CI.

| Defect | Symptom | Fix |
| --- | --- | --- |
| Stale-response guard compared the *trimmed* query against the *raw* one | Typing a trailing space left the palette on "Searching…" forever — no results, no error, unrecoverable without reopening | `queryRef` holds the trimmed query; `setSearching(false)` moved inside the same guard as the results write |
| `plainto_tsquery` matches whole lexemes only | `"anj"` found nothing while `"anjali"` worked — indistinguishable from a broken feature | `prefix_tsquery()` stems each term with the same `english` config the vectors use, then applies `:*` |
| `phone` absent from `contact_search_tsv` | The one lookup a sales team actually needs was impossible | Phone indexed digits-only under `simple`, in **both** the full and national forms — `+91 98250 12345` is otherwise three lexemes, and indexing only the digits as stored hid the number as written on a card |
| e2e "search" test asserted `<body>` was visible; unit test mocked the DB | Nothing could fail | `tests/e2e/search.spec.ts` — six real-browser tests |

Migration `20261003120000_search_phone_prefix`. The GIN index is defined over the
function call, so the signature change required `DROP INDEX` + `CREATE INDEX`;
`CREATE INDEX IF NOT EXISTS` would have silently kept the stale index.

## Schema / client / database drift

This failure mode cost real time and is worth naming, because **nothing warns
you**:

```
Unknown field `wonAt` for select statement on model `Deal`
```

A field is added to `prisma/schema.prisma` and used in a query, and the app
500s on *every* page render behind the dev overlay — while `tsc` passes, because
the generated client is a dependency rather than an input. It presents as "the
search box is dead", since the whole shell fails to mount.

Two structural guards now exist:

- `predev` / `prebuild` run `prisma generate`, so the client cannot be stale in
  any normal path.
- `npm run db:verify-sync` compares the schema, the applied migrations and the
  live database, and names the specific field or migration responsible. It
  honours `@map()` and `@@map()`, so `brokerId @map("cpId")` and
  `model Broker @@map("ChannelPartner")` are not reported as drift.

Run it after any schema edit and before a demo.

## Lead-ingress hardening (2026-10-03)

The lead pipeline is the product. It was also the least defended surface in
the app, and the gap mattered commercially: "we stop you losing leads" is the
pitch, so an open write endpoint is not a theoretical concern.

| # | Risk | Status |
| --- | --- | --- |
| A | `/api/webhooks/leads/[source]` accepted **unauthenticated** POSTs. Any caller who knew a workspace slug could inject leads. Slugs are public — they appear in micro-site URLs (`/sites/<slug>/<projectId>`). | **Fixed.** Per-workspace ingest secret (`x-estate360-ingest-key` / `x-ingest-key` / `Authorization: Bearer`), verified with a constant-time compare against a sha256 hash in `Workspace.settingsJson`. Unconfigured workspace returns **503** in production, not 401, so a portal retries instead of dropping leads. |
| B | `processLead` auto-acked new leads over WhatsApp, gated only on `optedOut`. Combined with A, a third party could make a customer's business number send unsolicited messages to arbitrary phone numbers — a WhatsApp policy ban on **that customer's** account, plus DPDP exposure. | **Fixed.** Auto-ack now requires *both* an authenticated-or-anti-spam-gated ingress (`trusted`) *and* an explicit per-workspace opt-in that defaults **off** (`Workspace.settingsJson.leadIngest.autoAck`). Replay never sends. |
| C | No rate limiting on public endpoints. | **Fixed.** `/api/sites/enquiry` (5 / 10 min per IP, 200 / day per project), `/api/webhooks/leads/*` (120 / min per IP, 600 / min per workspace+source), `/api/v1/contacts` (120 / min per key) — all through the shared `modules/web-contact/rate-limit.ts` (Upstash → in-memory). |
| D | Dedupe could not stop injected leads: `dedupeKey` hashes source+phone+email+name, so varying the phone number yields a fresh lead every time. | **Mitigated** by A/C above; dedupe is still not a security control and should not be relied on as one. |
| E | The DPDP audit Activity asserted `Consent recorded` unconditionally, including for leads that were never messaged. | **Fixed.** Now records the actual basis and whether anything was sent. |
| F | `/api/sites/enquiry` accepted a submission with no phone and no email and scored it as a lead. | **Fixed.** Rejected before the pipeline. Honeypot field added to the micro-site form. |
| G | `verifyApiKey` compared sha256 hashes with `===`. | **Fixed.** `timingSafeEqual`. |

Two things this pass does **not** do, both needing a migration or a UI:

- **No way to mint a secret from the app UI.** `createIngestSecret` /
  `revokeIngestSecret` / `setAutoAck` exist in `modules/leadIngest/ingress.ts`,
  are exposed as ADMIN-gated server actions in `modules/leadIngest/actions.ts`,
  and are drivable from the CLI (below) — but there is still no settings screen
  that calls them.
- **No per-project token for the micro-site form.** A browser form cannot send
  a header, so it is protected by rate limit + honeypot only. A per-project
  public token would be stronger; it needs a `Project` column.

### Provisioning and verification (shipped)

The managed/done-for-you motion needs setup to be repeatable, otherwise the
second customer costs the same as the first. Two scripts:

| Command | Purpose |
| --- | --- |
| `npx tsx scripts/provision-pilot.ts --client … --slug … --owner-email … --inventory …` | Creates the workspace, owner login, the six-stage pipeline, imports inventory CSV, mints the ingest secret, prints a handoff sheet. Idempotent. |
| `npx tsx scripts/verify-ingress.ts [base-url]` | 13 checks over real HTTP against the real DB: unauthenticated refused, wrong key refused, nothing written by refused calls, authenticated lands a scored+routed lead, no outbound while auto-ack is off, dedupe holds, outbound on once opted in. Creates and deletes its own workspace. |
| `npm run db:verify-sync` | Compares schema.prisma, `_prisma_migrations` and the live database; names the specific field or migration responsible. Run after any schema edit. |

Run `pilot:verify` after touching ingress code, before any demo, and whenever a
customer reports leads not arriving — it separates their portal's problem from
ours. Both scripts reuse `modules/leadIngest/ingress` rather than reimplementing
the settings shape, because a secret written in a different shape than
`requireIngressAuth` reads is one that silently never verifies.

Verified 2026-10-03: `13/13 checks passed` against a running instance and the
live Supabase database; a provisioned workspace imported 11 units across 3
projects (2 towers, 3 floors) and accepted an authenticated lead that produced a
contact scored 85 and a routed deal.

> **npm 11 drops `--flags` from `npm run … -- …`.** Use `npx tsx <script>` with
> options, or set `PILOT_BASE_URL`. The npm aliases still work with no options.

## Must fix before production (blockers)

| # | Item | Where | Action |
|---|---|---|---|
| 1 | **In-memory queues** don't survive multi-instance / serverless | lead ingest, social, background jobs | Swap to a durable queue (BullMQ/Redis or Vercel Queues) before horizontal scale. Single instance only today. |
| 2 | **Rate limiter falls back to in-process memory** when `UPSTASH_REDIS_REST_URL` is unset — currently unset in `.env`, so production would run on the memory fallback | `modules/web-contact/rate-limit.ts` | Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` before go-live. Until then the effective limit is per-instance. |
| 3 | **Secrets & prod env** | Vercel project settings | Set `AUTH_SECRET`, `AUTH_URL` (prod domain), `DATABASE_URL` (pooled), Stripe/Twilio/UPI keys. Confirm none are committed. |
| 4 | **Webhook signature verification** | `app/api/webhooks/*`, `payments/upi/webhook` | Stripe, Razorpay and WhatsApp now verify signatures. Lead ingress uses a shared secret (see A above). Confirm each provider's signature path before go-live. |
| 5 | **DB migrations applied** | Supabase prod | Run `prisma migrate deploy` against production; confirm schema matches. |

## Should fix (hardening)

- **Cache generated PDFs** — persist to Supabase Storage and set `GeneratedDocument.pdfUrl` instead of rendering on every download (Chromium cold start is ~1–2s).
- **PDF cold-start cost** — headless Chromium adds ~50MB and latency on serverless; if PDF volume is high, move rendering to a dedicated function or pre-generate on booking.
- **Observability** — error tracking (Sentry) + structured logs on server actions and webhooks.
- **Backups** — confirm Supabase point-in-time recovery / scheduled backups are on.
- **DPDP compliance** — verify the consent/data-request flow (`api/compliance/dpdp`) end-to-end against the new audit wording.
- **Accessibility + SEO** — run Lighthouse on marketing + app shells.
- **Load test** the booking → payment → document flow.
- **Lint is failing repo-wide** (166 errors) — pre-existing, unrelated to lead ingest. Fix or scope the ESLint gate before wiring CI to it.

## Verified this pass

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 624 passed, 2 skipped, 0 failing.
- Two previously-failing suites (`billing`, `contact-quota`) were not logic
  failures: both timed out at vitest's 5s default while importing the Prisma
  client and server-action graph. `testTimeout` is now 30s, which also cut the
  suite from 123s to ~22s. `marketing-seo`'s llms.txt check compared raw bytes
  against a git-`autocrlf` CRLF checkout and failed only on Windows; it now
  normalizes line endings.
- `tests/unit/lead-ingress.test.ts` (ingress auth) and
  `tests/integration/lead-ingest.test.ts` (auto-ack gating in both directions)
  are new and pin the controls above.

## Continuous integration

Two workflows, split by what they need:

| Workflow | Runs | Needs |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Every push and PR | Nothing. `vitest.config.ts` injects its own dummy `DATABASE_URL`, so the whole unit + integration suite runs without a database and is safe on an untrusted fork. |
| `.github/workflows/db-checks.yml` | Push to `master`, weekly cron, manual | `DATABASE_URL`. Runs `npm run db:verify-sync`, which compares `schema.prisma`, the applied migrations and the live database. |

Lint runs blocking at `--max-warnings 0`. It was non-blocking while a counted
backlog of warnings was open, on the reasoning that a permanently red job gets
ignored — which is the right call and the wrong long-term home. The count reached
zero when the unused-binding cleanup landed, so the escape hatch is removed
rather than kept as a habit: a new warning now fails on the commit that caused it,
which is the only point at which anyone knows which change it was.

Neither workflow runs the Playwright e2e suite: it needs a seeded database and a
running server, which is a deployment concern rather than a PR gate. Run
`npm run test:e2e` locally before a release.

### Tenant-visibility gates

Two suites keep broker scoping from regressing, and they are deliberately
separate:

- `tests/unit/broker-scope-registry.test.ts` — every tenant read path in
  `modules/**/queries.ts` has a recorded broker-visibility decision. A new query
  function fails until someone decides whether a broker may see its rows. All 43
  are currently classified; entries marked `workspace-wide` must state why.
- `tests/unit/broker-scope-reads.test.ts` — the predicate that reaches Prisma
  carries the broker id and is absent for every other role. A structural check
  cannot do this: a filter call whose result is discarded looks identical to one
  that is applied.

Add to both when a new module gets a `queries.ts`.
