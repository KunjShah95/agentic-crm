# Estate360 — Production Readiness Checklist

**Updated:** 2026-09-13. Status of what's done vs. what must happen before go-live.

---

## Done in this pass

- [x] **Real RERA document templates** seeded — Demand Letter, Allotment, Booking Form, Receipt, Possession (`prisma/seed.ts`). Replaces the previously empty/placeholder Documents page.
- [x] **Real-estate demo data** — "Skyline Residences" (Ahmedabad, RERA no.), Tower A, floor 12, unit A-1204 (3BHK), cost sheet, booked deal, and one pre-generated Allotment Letter so the Documents page shows real content out of the box.
- [x] **Real PDF download** — headless-Chromium renderer (`lib/pdf.ts`, `puppeteer-core` + `@sparticuz/chromium`):
  - Documents: `GET /[workspace]/documents/[id]/pdf` → styled A4 PDF, "Download PDF" button on each doc card.
  - Reports: `?format=pdf` on the reports export route + PDF/Excel buttons in the reports UI.
- [x] **`.env.example`** documents `PUPPETEER_EXECUTABLE_PATH` for local dev.

---

## Must fix before production (blockers)

| # | Item | Where | Action |
|---|---|---|---|
| 1 | **In-memory queues** don't survive multi-instance / serverless | lead ingest, social, background jobs | Swap to a durable queue (BullMQ/Redis or Vercel Queues) before horizontal scale. Single instance only today. |
| 2 | **Failing unit test** | `tests/unit/search-queries.test.ts` | `plainto_tsquery` assertion fails (pre-existing). Fix the query or the test before CI gating. |
| 3 | **Secrets & prod env** | Vercel project settings | Set `AUTH_SECRET`, `AUTH_URL` (prod domain), `DATABASE_URL` (pooled), Stripe/Twilio/UPI keys. Confirm none are committed. |
| 4 | **Webhook signature verification** | `app/api/webhooks/*`, `payments/upi/webhook` | Verify each provider's signature (Stripe already; confirm leads/social/UPI). Reject unsigned/replayed payloads (idempotency via `WebhookEvent`). |
| 5 | **Rate limiting on public endpoints** | `api/sites/enquiry`, webhooks, `api/v1/*` | Add per-IP / per-key throttling (Upstash ratelimit) to stop abuse. |
| 6 | **DB migrations applied** | Supabase prod | Run `prisma migrate deploy` against production; confirm schema matches. |

---

## Should fix (hardening)

- **Cache generated PDFs** — persist to Supabase Storage and set `GeneratedDocument.pdfUrl` instead of rendering on every download (Chromium cold start is ~1–2s).
- **PDF cold-start cost** — headless Chromium adds ~50MB and latency on serverless; if PDF volume is high, move rendering to a dedicated function or pre-generate on booking.
- **Observability** — error tracking (Sentry) + structured logs on server actions and webhooks.
- **Backups** — confirm Supabase point-in-time recovery / scheduled backups are on.
- **DPDP compliance** — verify the consent/data-request flow (`api/compliance/dpdp`) end-to-end.
- **Accessibility + SEO** — run Lighthouse on marketing + app shells.
- **Load test** the booking → payment → document flow.

---

## Verified this pass

- `npx tsc --noEmit` — clean for all touched files (one unrelated stale `.next/types` artifact clears on `next build`).
- `npx vitest run` — 188 passed, 1 pre-existing failure (search-queries, item #3), 2 skipped.
- PDF rendering path is code-complete; runtime render needs a live Chrome locally (`PUPPETEER_EXECUTABLE_PATH`) or Vercel's bundled Chromium.
