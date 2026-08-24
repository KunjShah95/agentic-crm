# Phase 3 — Omnichannel Social + Hybrid SaaS Design

**Date:** 2026-08-24
**Scope:** Phase 3 — Hybrid billing + omnichannel social (Tier 1: LinkedIn + X + WhatsApp) on top of Phase 1 core CRM
**Stack:** Next.js 15 App Router + TypeScript, Prisma + Postgres (Neon), NextAuth v5, BullMQ + Redis (Upstash), Stripe, shadcn/ui + Tailwind v4, Vercel (Fluid)
**Depends on:** Phase 1 (multi-tenant CRM, Activity timeline, tsvector search, role matrix)

---

## Goals / Non-Goals

**Goals:**
- Monetize the CRM with hybrid metering (seats/contacts + social throughput + future agent credits) behind Stripe.
- Connect every social touch (LinkedIn/X/WhatsApp DM, comment, mention, message) to the CRM as a workspace-scoped `Activity {source:'social'}` with contact identity resolution — no manual logging.
- Allow outbound via the CRM through a uniform `SocialProvider` seam, respecting each provider's rate limits and token lifecycle.
- Build the boring hard plumbing (idempotent webhooks, token rotation, quota fairness, DLQ) that competitors skip — the moat.

**Non-goals (v1):**
- No TikTok/YouTube/Telegram/Discord (Tier 3) — architecture supports them as new `SocialProvider` impls.
- No agent execution beyond `Activity.source='agent'` placeholder; agents will *produce* through the same queue in Phase 2 extension.
- No email/calendar send — out of Phase 1 scope, remains out here.

---

## Architecture

```
Next.js 15 (Vercel)
├── /api/webhooks/social/[provider]  — thin ingress: verify sig → queue.add({jobId: eventId}) → 200
├── /api/webhooks/stripe             — Stripe events → queue.add('billing')
├── /api/cron/refresh-social-tokens  — hourly token refresh
├── /api/billing/{checkout,portal}   — Stripe Checkout + Billing Portal
├── modules/social/                  — SocialProvider adapters
│   ├── XDirectProvider              — X OAuth 2.0 + v2 webhooks
│   ├── WADirectProvider             — WhatsApp Cloud API
│   └── LIUnipileProvider            — Unipile wrapper (swappable)
├── modules/billing/                 — PlanLimits, UsageEvent, requireQuota()
├── worker/social-ingest             — BullMQ consumer (separate deployment)
│   dedupe → identity resolve → requireQuota → Activity + UsageEvent + Counter
└── lib/{permissions,auth,db}        — extended; every query where: {workspaceId}
```

**Infra:** Postgres (primary) + Redis (Upstash) + BullMQ. Queue `social-ingest` with per-workspace concurrency, `jobId = providerEventId`, 5 attempts exponential backoff, DLQ after exhaustion. Tokens encrypted `AES-GCM` with `SOCIAL_TOKEN_KEY`. Stripe is source of truth for `Subscription`; `Workspace.plan` is derived.

---

## Data Model

New tables — additive migration `20260824000001_social_billing`, no Phase 1 downtime.

```prisma
model Subscription {
  id               String   @id @default(cuid())
  workspaceId      String   @unique
  stripeCustomerId String   @unique
  stripeSubId      String?  @unique
  plan             String   // free | pro | scale
  status           String   // active | past_due | canceled
  currentPeriodEnd DateTime?
  workspace        Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@index([status])
}

model PlanLimits { // seed, not per-workspace
  plan              String @id // free | pro | scale
  maxSeats          Int
  maxContacts       Int
  maxSocialAccounts Int
  msgPerMonth       Int
  webhookPerDay     Int
  agentCreditsPerMo Int @default(0)
}

model SocialConnection {
  id                String   @id @default(cuid())
  workspaceId       String
  provider          String   // linkedin | x | whatsapp
  externalAccountId String
  displayName       String?
  accessTokenEnc    String
  refreshTokenEnc   String?
  expiresAt         DateTime?
  status            String   @default("active") // active | needs_reauth | revoked
  lastSyncAt        DateTime?
  workspace         Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@unique([workspaceId, provider, externalAccountId])
  @@index([provider, status])
}

model SocialEvent { // idempotency + audit, retains payload 30d
  id          String   @id // provider eventId
  workspaceId String
  provider    String
  type        String   // dm | comment | mention | message
  payload     Json
  dedupeKey   String   @unique
  processedAt DateTime?
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@index([workspaceId, provider])
}

model UsageEvent { // append-only ledger
  id          String   @id @default(cuid())
  workspaceId String
  kind        String   // social_messages | webhook_events | contacts | seats | agent_credits
  count       Int      @default(1)
  createdAt   DateTime @default(now())
  meta        Json?
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@index([workspaceId, kind, createdAt])
}

model UsageCounter { // materialized monthly counters for fast checks
  workspaceId String
  kind        String
  period      String   // 2026-08
  count       Int      @default(0)
  @@id([workspaceId, kind, period])
}
```

**Patches to Phase 1:**
- `Activity.source` gains index; allow `'social'` (now) and `'agent'` (later); add `socialEventId String?` FK to `SocialEvent`.
- `Contact.handles Json?` → `{linkedin?: string, x?: string, whatsapp?: string}` for identity map.
- `Workspace` gains relation `subscription Subscription?`, `socialConnections SocialConnection[]`, `usageEvents UsageEvent[]`.

All queries remain `where: {workspaceId}` — no cross-tenant leak.

---

## SocialProvider Seam

```ts
interface SocialProvider {
  provider: 'linkedin' | 'x' | 'whatsapp'
  getAuthUrl(workspaceId: string): string
  handleCallback(code: string, workspaceId: string): Promise<Tokens>
  refresh(conn: SocialConnection): Promise<Tokens>
  verifyWebhook(req: Request): boolean
  normalize(raw: unknown): SocialNormalized // {externalId, type, from:{handle, displayName}, body, timestamp, threadId?}
}
```

- **XDirectProvider:** OAuth 2.0 PKCE, `dm_events` + `tweets` webhooks, rate limit 300 req/15min handled via token bucket.
- **WADirectProvider:** Meta Cloud API `hub.verify_token`, `messages` webhook, 24h window enforcement, template approval state.
- **LIUnipileProvider:** Wraps Unipile REST — isolates LinkedIn risk; same `normalize()` shape so swapping to direct partner later is one impl change.

Factory `getProvider(provider: string): SocialProvider` used in ingress and worker — no `if (provider === 'x')` scattering.

---

## Webhook Ingress & Worker

**Ingress `POST /api/webhooks/social/[provider]` (thin, <100ms):**
1. Resolve `provider` → `getProvider(provider).verifyWebhook(req)` (HMAC / X `crc_token`).
2. Lookup `SocialConnection` by `provider + externalAccountId` (or by webhook `appId` → workspace).
3. `normalize(raw)` → `{externalId, type, fromHandle, body}`.
4. `queue.add('social-ingest', normalized, {jobId: externalId, attempts: 5, backoff: {type:'exponential', delay: 2000}})` → 200 OK. Never 500 to provider.

**Worker `social-ingest` (owns the hard parts):**
1. **Dedupe:** `INSERT SocialEvent` with `ON CONFLICT (dedupeKey) DO NOTHING` → if 0 rows, no-op (idempotent replay).
2. **Identity resolve:** Try `Contact` by `handles[provider]`, then `phone` (WA), then `emailDomain` + `getLinkableContacts` heuristic, then create `Contact {firstName: displayName, handles, createdBy: 'system:social'}`.
3. **Quota:** `requireQuota(workspaceId, 'social_messages' | 'webhook_events')` — reads `PlanLimits[plan]` vs `UsageCounter[period]`. Throws `QuotaExceeded` → write `Activity {source:'social', body: 'Quota exceeded — upgrade'}` + DLQ, do not increment.
4. **Write:** `db.$transaction([create Activity {workspaceId, source:'social', socialEventId, contactId/dealId, body, createdBy: 'system:social'}, create UsageEvent, upsert UsageCounter increment])`.
5. **Rate limit:** Redis token bucket per `SocialConnection`; on 429 requeue with `delay: retryAfter`.
6. **Ordering:** Queue concurrency key `workspaceId:provider` ensures per-workspace FIFO for same provider.

**Token rotation:** `GET /api/cron/refresh-social-tokens` (Vercel Cron hourly) refreshes `expiresAt < now+1h`; encrypts with `AES-GCM`. On failure sets `status='needs_reauth'` → UI banner `Components/SocialReconnectBanner` → webhooks still queued but worker pauses for that connection.

**DLQ:** After 5 fails, `SocialEvent.processedAt = null`, payload + error retained, replay via `POST /api/admin/social/replay {eventId}` (ADMIN only).

---

## Billing & Quota Enforcement

- **Stripe:** Products `free/pro/scale` map 1:1 to `PlanLimits.plan`. Checkout `POST /api/billing/checkout {plan}` → Stripe Session → webhook `checkout.session.completed` / `customer.subscription.updated` → upsert `Subscription` + set `Workspace.plan`. Portal via `POST /api/billing/portal`.
- **Quota:** `requireQuota(workspaceId, kind)` is the single gate — called in `social-ingest` before send/receive, in `contacts` create/bulk import, and in future `runAgent`. Throws `AppError('QUOTA_EXCEEDED', 402)`. UI shows `UsageCounter` bars in `/[workspace]/settings/billing` + Stripe portal link.
- **Seats/contacts:** Enforced same way — `UsageCounter` for `contacts` incremented on `createContactAction`; `seats` checked on `inviteMemberAction` against `PlanLimits.maxSeats`.
- **Admin:** `ADMIN/OWNER` can view billing; `OWNER` can manage subscription (Stripe portal).

---

## Identity Resolution & Timeline

- Reuses Phase 1 `getLinkableContacts` pattern for email domain → org link suggestion.
- Social `Activity` appears in contact *and* deal timelines (`modules/contacts/queries` + `modules/deals/queries` already include `activities`); filter `source='social'` vs `manual`.
- `Contact.handles` enables future dedup across providers without schema change.

---

## Error Handling

- Server actions return `{data,error}` union — new codes: `QUOTA_EXCEEDED (402)`, `SOCIAL_NEEDS_REAUTH (401)`, `SOCIAL_RATE_LIMITED (429)`, `SOCIAL_PROVIDER_ERROR (502)`.
- Webhook ingress never returns 500 — verify failures → 401, queue failures → 200 + DLQ alert (prevents provider retry storms).
- All provider `normalize()` inputs validated with Zod at boundary before DB.
- `requireWorkspaceMember` still gates every social/billing route (403 on fail).
- Stripe webhook verified with `stripe.webhooks.constructEvent`; idempotent via `stripeEventId` unique.

---

## Testing Strategy

- **Unit:** `hasMinRole`, `PlanLimits` gating, `requireQuota` calc, `SocialProvider.normalize`, token encrypt/decrypt, stage reorder, `emailDomain`.
- **Integration:** Prisma against real test Postgres — create `SocialConnection` with encrypted tokens, ingest `SocialEvent`, assert `Activity` + `UsageEvent` + `UsageCounter` increment, workspace isolation, quota enforcement, idempotent replay.
- **E2E (Playwright):** critical paths — signup → create workspace (free) → hit contact limit → see quota CTA → mock Stripe webhook → upgrade to pro → connect mock X account → inject mock X webhook → see `Activity source:'social'` in timeline → move deal stage → verify `UsageCounter` bars in `/billing`. Mock providers via `msw` / webhook fixtures.

---

## Rollout & Ops

- Migration `20260824000001_social_billing` additive; run `prisma migrate dev` (requires live DB, no Phase 1 downtime).
- Seed `PlanLimits` (free: 1 seat/500 contacts/1 social account/100 msgs/mo; pro: 5/5k/3/5k; scale: 15/25k/10/25k).
- Feature flags `SOCIAL_ENABLED` / `BILLING_ENABLED` per env; worker scales independently (Vercel Fluid / Fly).
- Observability: `SocialEvent` payload 30d TTL, `UsageEvent` retained, DLQ + `sonner` toasts for `needs_reauth`/`rate_limited`.
- No PII in logs; token ciphertext never logged.

---

## Out of Scope

- TikTok/YouTube/Telegram/Discord (Tier 3) — add as new `SocialProvider` without changing worker/billing.
- Agent execution — `Activity.source='agent'` reserved; agents will enqueue via same `social-ingest` queue.
- File attachments, public API, mobile app.
