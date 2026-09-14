# Two-Way Provider Integration — WhatsApp End-to-End Design

Date: 2026-09-14
Status: Approved (approach A: unify on the connection-centric provider seam)
Owner slice: WhatsApp fully two-way (connect → receive → reply → status); architecture makes any future provider a one-file adapter.

## Problem

The inbox is read-only and the two-way chain is broken in four places:

1. **No connection bootstrap** — the Connect button OAuth-redirects to `/api/auth/{provider}/callback`, which doesn't exist (404). `createConnection` is never called, so no per-tenant tokens are ever stored.
2. **No queue consumer** — social webhooks verify + normalize + enqueue to BullMQ, but `bullmq`/`ioredis` aren't installed and no `Worker` runs. `worker/social-ingest.ts::ingestSocialEvent` is orphaned.
3. **Two disjoint WhatsApp rails** — direct global-env-token path (`/api/whatsapp/webhook`, drops unknown senders) vs connection-scoped social path (never processed).
4. **No composer** — `sendWhatsAppMessage`/`sendSmsMessage`/`sendEmailMessage` have zero UI callers.

## Goals

- WhatsApp end-to-end: per-workspace OAuth connect → inbound messages into inbox timeline → reply from a composer → delivery status ticks.
- One `MessagingProvider` seam; adding a provider = implement interface + one registry entry.
- Vercel-serverless-safe: **no Redis/worker dependency** — synchronous, idempotent webhook processing backed by Postgres dedupe.
- Keep the existing real-else-mock fallback so dev/CI run credential-free.
- Verified live against Meta's free Test WhatsApp Business Account (user creates app + test WABA).

## Non-Goals (future slices)

- Inbound media download/storage (this slice: type placeholders + raw handles in `SocialEvent.payload`).
- SMS/Email/IG/X outbound wired through the new seam (composer shows "connect to enable"; providers added later).
- WhatsApp template-message (HSM) composer flow (outside 24h window we block free text and explain; existing cost-sheet template sends stay as-is).
- Meta Embedded Signup (v1 uses the classic OAuth dialog; swappable behind `getAuthUrl`).
- New Conversation/Message data model (Activity stays the timeline primitive).

## Architecture

### The seam (modules/social/)

```ts
// types.ts (extended)
export type NormalizedEvent =
  | { kind: "message"; externalId: string; from: { number?: string; handle?: string; name?: string };
      body: string; mediaType?: "image" | "audio" | "document" | "video" | "sticker";
      timestamp: string; threadId?: string }
  | { kind: "status"; externalId: string; status: "sent" | "delivered" | "read" | "failed" };

export interface Tokens {
  accessToken: string; refreshToken?: string; expiresAt?: Date;
  externalAccountId: string; displayName?: string; metadata?: Record<string, unknown>;
}

export interface MessagingProvider extends SocialProvider {
  // changed/added members:
  parseEvents(payload: unknown): NormalizedEvent[];              // replaces normalize(); batch — Meta posts arrays
  send(ctx: { accessToken: string; metadata: Record<string, unknown>; to: string; body: string })
    : Promise<{ externalId: string; mock: boolean }>;
  handleCallback(params: { code: string; codeVerifier?: string; state?: string }): Promise<Tokens>; // gains metadata/identity
}
```

- `provider.ts` registry stays (alias map + `getProvider`); WhatsApp registers under `whatsapp`/`wa`.
- `providers/whatsapp.ts` (reference impl, absorbs `modules/whatsapp/adapter.ts` Cloud API send):
  - `send()` POSTs to `graph.facebook.com/v21.0/{phone_number_id}/messages` using the **connection's** token (from `SocialConnection.accessTokenEnc`) and **connection's** `metadata.phone_number_id`; falls back to `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_ID` env only when a single-tenant dev config requests it (no connection row). Returns real `wamid` or `{ id: "mock-...", mock: true }`.
  - `parseEvents()` handles Cloud API webhook batches: `entry[].changes[].value.messages[]` (text, image, audio, document, video, sticker, button reply → `[Photo]`-style placeholder body when type ≠ text; media id retained in raw payload) and `.statuses[]` → status events.
  - `verifyWebhook()`: existing hub.challenge token check + timing-safe `X-Hub-Signature-256` HMAC with `WHATSAPP_APP_SECRET`. POST processing **never runs on an unverified request**.
  - `handleCallback()`: exchanges the code, then `GET /{wabaId}/account_phones?access_token=...` (or `me/accounts` → WABA → phone numbers) to resolve the connected number → returns `externalAccountId=wabaId|phone_number_id`, `displayName` (the number), `metadata={ phone_number_id, wabaId }`.
- Legacy `modules/whatsapp/adapter.ts` remains for `leadIngest` auto-ack (keeps working) but delegates to the seam send once a connection exists. Its webhook route stays alive as **dev fallback only** and logs a deprecation notice; tenant routing for real connections comes from `SocialConnection.metadata`.

### Data model (one Prisma migration)

- `Activity`:
  - `externalId String? @unique` — provider message id (wamid). Enables receipt updates + replay dedupe. Outbound stores real/mock id; inbound stores the inbound wamid.
  - `status String?` — `sent | delivered | read | failed` (outbound only).
- `SocialConnection`:
  - `metadata Json?` — `{ phone_number_id, wabaId }` for WhatsApp; the **tenant-resolution key** for inbound.
- `SocialEvent` unchanged (dedupeKey unique = idempotency backbone; `payload Json` retains raw event incl. media handles).
- Existing `Activity.channel/direction/source` free-string convention continues (`"WHATSAPP"`, `"IN"/"OUT"`, `"social"`).

### Auth / connect flow

1. Settings → Social → **Connect WhatsApp** → server action `getSocialAuthUrlAction` (exists) → `provider.getAuthUrl(state)` where state = base64url JSON `{workspaceId, provider, nonce}` (exists).
2. **NEW** generic callback route `app/api/auth/social/[provider]/callback/route.ts`:
   - decode+validate state (workspace exists, provider known; nonce round-trip) → `provider.handleCallback({code, state})` → `createConnection` (upsert; AES-256-GCM encrypted tokens; stores `metadata`, `displayName`) → redirect `/{slug}/settings/social?connected=whatsapp`.
   - Errors (bad state, token exchange fail) → redirect `?error=connect_failed`. Route is auth-gated via session lookup before trusting state.
3. Disconnect (exists) stays; mark `needs_reauth` on refresh failure.
4. `cron/refresh-social-tokens` (exists) gets a `vercel.json` schedule entry (`0 6 * * *`) with `CRON_SECRET` header. WhatsApp long-lived tokens don't expire — refresh is a no-op there — but the cron unblocks X/LinkedIn lifecycle.

### Inbound flow (the core fix)

`POST /api/webhooks/social/whatsapp` — thin, idempotent, synchronous (no queue):

1. `verifyWebhook` (signature + token) → 401 otherwise.
2. `parseEvents(body)` → for each event, best-effort tenant resolution from the batch metadata (`phone_number_id` → connection lookup → `workspaceId`; dev fallback: env single-workspace). Unresolvable → store to `WebhookEvent` unprocessed for observability, return 200.
3. `ingestNormalizedEvent(workspaceId, provider, event, raw)` — extracted from the orphaned `worker/social-ingest.ts` and reused by the replay endpoint:
   - **message events**: dedupe insert `SocialEvent` (unique `dedupeKey = provider:externalId`; collision → skip). Quota `requireQuota(ws, "social_messages")`. Identity: normalize phone (last 10 digits) → existing contact, else **auto-create Contact** (`leadSource: "whatsapp-inbound"`, phone, profile name) — a fresh number messaging us is a lead, not garbage. Consent: inbound = they contacted us; `optedOut` untouched.
   - Write `Activity { channel:"WHATSAPP", direction:"IN", type:"NOTE", source:"social", body, externalId: wamid }` + UsageEvent/UsageCounter (existing helper flow).
   - **status events**: `Activity.updateMany({ where: { externalId } })` → new `status`. Unknown id → ignore (race vs send persist is acceptable; Meta retries).
   - `SocialConnection.lastSyncAt` touched.
4. Always respond 200 (Meta hammers retries on non-200); processing failures logged + `SocialEvent.processedAt` left null → `/api/admin/social/replay` (exists) re-runs the same ingest function.
5. Wrap post-parse work in `after()` (Next 15) where latency matters; keep it simple first — Meta allows several seconds.

Replaces: queue enqueue path in `app/api/webhooks/social/[provider]/route.ts` (whatsapp provider switches to sync ingest; other providers unchanged until they implement the new seam). The `getQueue()` fallback chain remains in code untouched (harmless) — we simply stop depending on it.

### Outbound flow

1. Inbox composer (client component) → server action `sendChannelMessage({ workspaceId, contactId, channel, body })` in `modules/comms/outbox.ts`:
   - session/workspace-member auth; contact lookup; `optedOut` → refuse; no phone → refuse.
   - **24h window gate**: last inbound Activity (direction IN, channel WHATSAPP) must be < 24h old for free-form text (Meta policy). Outside window → typed error → composer explains "conversation window closed — template messages coming soon" and disables send.
   - Resolve `SocialConnection` (active) for workspace+channel → decrypt token → `provider.send()` → on failure with expired token: `markNeedsReauth` + friendly error.
   - Persist `Activity { channel, direction:"OUT", source:"manual", createdBy: user, body, externalId, status:"sent", contactId, dealId? }`; `revalidatePath(inbox)`.
   - No connection + dev env creds → mock send recorded (keeps dogfooding possible before connect).
2. Quota: `requireQuota(ws, "messages")`-style monthly msg limit honored if the plan helper supports the key (else add key).

### UI

- `components/inbox/InboxTimeline.tsx`: render `status` ticks on OUT bubbles (sent ✓, delivered ✓✓, read ✓✓ brand-blue, failed ✕) + `[Photo]`-style media placeholders (already plain body text).
- **NEW** `components/inbox/Composer.tsx`: textarea (Cmd/Ctrl+Enter send), channel pills (WhatsApp active when connected; SMS/Email disabled with "Connect to enable" tooltip → settings link), window-state hint ("Reply window: 23h left" computed server-side from last inbound), optimistic bubble + error state.
- `inbox/page.tsx`: pass active connection state + last-inbound time into the pane; mount `<Composer/>` for the selected contact.
- Settings → Social: connect/disconnect feedback banner from `?connected=` / `?error=` params; card shows `displayName` (connected number) + `lastSyncAt`.
- `components/settings/extended-settings-tabs.tsx`: replace the fake "WhatsApp Cloud API Inbox" useState toggle with real connection status (from DB) linking to Settings → Social.

### Env & config housekeeping

- `.env.example`: document all messaging vars (Meta app id/secret/redirect/verify token/app secret, WHATSAPP_TOKEN/PHONE_ID as dev-fallback, RESEND/TWILIO, SOCIAL_TOKEN_KEY, CRON_SECRET, UPSTASH optional).
- `vercel.json`: cron for token refresh.
- Fix `verifyUnipileWebhook` failing **open** without secret → fail closed (one-liner, same seam).

### Error handling

- Webhook: never 5xx for provider payloads (Meta retry storm); bad signature → 401; unresolvable tenant → logged + 200.
- Sends: typed error results (no-connection / expired / window-closed / opt-out / quota) → distinct composer messages, never silent.
- All DB work per event in one transaction (dedupe row + activity + usage) so replays are consistent.
- DPDP: sends remain blocked on `optedOut`; inbound ingest never flips consent flags.

### Testing

- Unit (vitest): `parseEvents` fixtures (text batch, media types, statuses, button reply); `verifyWebhook` signature/token cases (incl. missing-secret fail-closed); window gate math; phone normalization + contact resolution/auto-create; `send()` real-vs-mock with mocked fetch.
- Integration: fake `db`/in-memory store pattern (repo already does this in tests) — full ingest run: dedupe replay, status → Activity update, quota exceeded, unknown tenant → 200.
- Callback route: mocked Meta token exchange → connection row persisted encrypted → redirect.
- Playwright (existing config): connect-with-mock-Meta → send → inbound webhook fixture → bubble appears in UI.
- Manual: Meta Test WABA sandbox — real phone → CRM reply round trip, ticks update.

## Risks

- **Meta webhook latency vs Vercel function limits**: sync processing is O(few queries/event); Test WABA traffic is trivial. If it ever grows, the seam function is already idempotent → move to queued consumer without behavior change.
- **Mock wamids**: mock send stores `id: mock-...`; statuses never match those — composer shows "sent (mock)" explicitly for dev.
- **Two rails during transition**: legacy `/api/whatsapp/webhook` stays read-compatible; connections take priority in tenant resolution.

## Deployment order

1. Migration + seam types + WA provider (send/parse/verify) with unit tests.
2. Callback route + createConnection wiring (connect flow works end-to-end in dev with mock provider).
3. Inbound route rewrite + ingest extraction + integration tests.
4. Composer + outbox action + ticks + UI states.
5. Env example, vercel cron, unipile fail-closed, docs/README touch.
