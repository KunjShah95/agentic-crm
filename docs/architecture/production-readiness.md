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
- `npx vitest run` — 305 passed, 2 skipped, 0 failing.
- Two previously-failing suites (`billing`, `contact-quota`) were not logic
  failures: both timed out at vitest's 5s default while importing the Prisma
  client and server-action graph. `testTimeout` is now 30s, which also cut the
  suite from 123s to ~22s. `marketing-seo`'s llms.txt check compared raw bytes
  against a git-`autocrlf` CRLF checkout and failed only on Windows; it now
  normalizes line endings.
- `tests/unit/lead-ingress.test.ts` (ingress auth) and
  `tests/integration/lead-ingest.test.ts` (auto-ack gating in both directions)
  are new and pin the controls above.
