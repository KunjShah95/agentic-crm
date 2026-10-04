# Open security findings — tenant isolation review

Status as of commit `6f3e1d6`. These were found in the same review that produced
the fixes in that commit; they are **not yet fixed**. Each is verified (not
inferred) — the review read enough surrounding context to rule out an outer
guard before reporting.

Ordered by severity. Each entry names the file and the specific claim, so it can
be re-verified or fixed without redoing the review.

---

## HIGH — The third isolation layer does not exist

`README.md` and `docs/architecture/system-design.md` describe a three-layer
model: app gate → query scoping → **Postgres RLS backstop**. The first two are
real. The third is not.

- `prisma/migrations/20260913000001_enable_rag_rls/migration.sql` enables RLS on
  exactly four tables: `RagDocument`, `RagChunk`, `RagFeedback`, `RagQueryLog`.
  `Contact`, `Deal`, `Organization`, `Unit`, `Activity`, `Workspace`, `Payment`,
  `Broker`, `WebhookEvent`, `SocialEvent` have **no RLS and no policies**.
- Even for those four, the predicate resolves `private.current_tenant_id()` from
  `auth.jwt()` or the `app.current_tenant_id` / `app.tenant_id` GUCs. The
  application never sets any of them — `lib/db.ts` builds one long-lived
  `PrismaClient` with no per-request `set_config`, and there are no `set_config`
  callers anywhere in the TypeScript. Under `authenticated` those tables would
  return zero rows; under `service_role` the policy is `USING (true)`.
- `.env.example:19` documents `DATABASE_URL` as the Supabase `postgres` role,
  which carries `BYPASSRLS`, so RLS is skipped regardless of policy.

**Impact:** effective isolation is one layer, not three. A single forgotten
`workspaceId` on a CRM table is an immediate, unrecoverable cross-tenant
read/write. This is precisely the class of bug the other fixes in `6f3e1d6`
close at the application layer — which is now the *only* layer.

**To decide:** either enable RLS with policies for the CRM tables and have the
app set the tenant GUC per request, or correct the documentation. What should
not persist is a README claiming a backstop that is not deployed.

---

## MEDIUM-HIGH — `brokerScopeFilter` is applied to 3 of ~10 read paths

`lib/permissions.ts:73` documents BROKER-role users as seeing only their
allocated inventory and deals. Applied in `modules/brokers/queries.ts`,
`modules/booking/queries.ts`, `modules/reports/queries.ts`.

Not applied — these functions take no `role` parameter at all:

| File | Function |
| --- | --- |
| `modules/contacts/queries.ts:22` | `listContacts` |
| `modules/contacts/queries.ts:62` | `getContactDetail` |
| `modules/deals/queries.ts:10` | `getPipeline` |
| `modules/deals/queries.ts:31` | `listDealsForTable` |
| `modules/deals/queries.ts:45` | `getDealDetail` |
| `modules/deals/queries.ts:68` | `pipelineStats` |
| `modules/dashboard/queries.ts:172` | `getDashboardData` |
| `modules/ai/ask.ts:20` | workspace-wide ask |

**Impact:** a user invited as `BROKER` (rank 0) opens `/<slug>/contacts` or
`/<slug>/deals` and sees every contact and deal in the tenant, not just their
allocated book — exactly what `brokerScopeFilter` exists to prevent.

---

## MEDIUM — `WebhookEvent.dedupeKey` is globally unique and not tenant-scoped

`prisma/schema.prisma:298` declares `dedupeKey String @unique`;
`modules/leadIngest/normalize.ts:96` builds it as `${src}:${externalId}` with no
tenant component. `modules/leadIngest/worker.ts:49` looks it up by bare
`dedupeKey`, and `:217` updates the row by bare `dedupeKey`.

**Impact:** portal `external_id`s are per-portal sequential, so collisions across
tenants are the normal case, not an edge case. Tenant B's distinct lead with the
same portal id hits `existing.processedAt` and returns `deduped: true` — no
Contact, no Deal, no Activity, HTTP 200 "received", permanently and invisibly.
If the existing row is unprocessed, `:217` re-points tenant A's row to
`workspaceId: B`, so `replayPending({ workspaceId: A })` can no longer see it.
The same defect exists in the hashed fallback at `normalize.ts:88`.

**Fix shape:** include the workspace in the dedupe key and make the uniqueness
`(workspaceId, dedupeKey)`.

---

## MEDIUM — Foreign `contactId` / `organizationId` are accepted, then read back

`lib/actions/deals.ts:74` (`createDealAction`) and `:219` (`updateDealAction`);
`lib/actions/contacts.ts:123` and `:168`. Validators at `lib/validators.ts:43`,
`:59`.

`stageId` **is** validated against the workspace (`deals.ts:58`, `:207`), but the
two foreign keys that reach `include` clauses are not. Read-back happens at
`modules/deals/queries.ts:20` (`contact: { select: { …, email } }`), `:52`, and
`modules/contacts/queries.ts:66`.

**Impact:** a member of workspace A creates a deal with `contactId` set to a
workspace-B contact, then reads B's contact **email address** at `/A/deals/<id>`.

Note the sibling guards already exist elsewhere — `createActivityAction`
(`lib/actions/activities.ts:30`) and `linkContactToOrgAction`
(`lib/actions/organizations.ts:126`) validate both foreign keys. This is a gap
in the deals/contacts paths, not a policy decision.

---

## MEDIUM — `bulkTagDealsAction` creates join rows for unvalidated ids

`lib/actions/deals.ts:160` passes both id lists straight to `createMany` with no
workspace check. The contact twin `bulkTagContactsAction`
(`lib/actions/contacts.ts:231`) **does** validate both and comments "Verify all
contacts belong to this workspace" — so the deals path is a regression.

**Impact:** a member of A inserts `DealTag(deal = B's deal, tag = A's tag)`; the
tag name then renders inside B's deal detail (`modules/deals/queries.ts:56`) and
in B's exports.

---

## MEDIUM — `VIEWER` can mutate

`lib/permissions.ts:7` ranks `VIEWER` at 0, equal to `MEMBER`. But
`createContactAction`, `updateContactAction`, `createDealAction`,
`moveDealStageAction` and `bulkMoveDealsAction` gate on
`requireWorkspaceMember(workspaceId, userId)` with **no `minRole`** — only
deletes use `canManageData`.

**To decide:** if `VIEWER` is meant to be read-only (the name and the rank
strongly suggest so), every write action in `lib/actions/contacts.ts` and
`lib/actions/deals.ts` is missing the gate. If not, the rank and the name are
misleading. Either way it should be decided explicitly rather than left to
whichever action happens to pass a role.

---

## MEDIUM — Billing `priceId` allowlist is a no-op

`app/api/billing/checkout/route.ts:44`:

```ts
const isAllowed = allowed.has(priceId) || priceId.startsWith("price_")
```

The second disjunct accepts any price in any Stripe account, so the allowlist
restricts nothing. Auth itself is correct (`:30` requires ADMIN).

**Impact:** any workspace ADMIN can start a subscription on an arbitrary or
overpriced price; the failure surfaces as an opaque 500 from Stripe.

---

## LOW — Referential tenant gaps (write-only)

`setContactOwnerAction`, `bulkAssignContactsAction`, `bulkAssignDealsAction`
accept an arbitrary `ownerId` with no workspace-membership check;
`assignCommission` (`modules/brokers/actions.ts:47`) accepts an arbitrary
`brokerId`. `Deal.ownerId` is `onDelete: Restrict`, so a foreign user id is
accepted and their name/email then renders in the attacker's own workspace
(`modules/deals/queries.ts:38`) — low impact, but it writes cross-tenant
references that later queries assume are sound.

---

## LOW — `session.activeWorkspaceId` is client-writable

`lib/auth.ts:108` accepts any `activeWorkspaceId` from `useSession().update()`
without checking it is in `t.workspaces`. Harmless today because nothing
authorizes off that field — the URL slug drives the workspace — but it is a trap
for the next person who does.

---

## Verified clean

Recorded so these are not re-audited:

- **SQL injection.** All 6 raw-SQL sites bind parameters via tagged templates or
  `Prisma.sql`/`Prisma.join`: `modules/search/queries.ts:41,53,65`,
  `modules/rag/retrieve.ts:209`, `modules/rag/pgvector.ts:56,93,125,134`,
  `modules/billing/quota.ts:59`. The one string-built literal
  (`pgvector.ts:124`) is guarded by a dimension check and `Number.isFinite` per
  element. Every one carries its tenant predicate.
- **Mass assignment.** All `...spread` writes are spreads of `zod.parse()` output
  (which strips unknown keys), and each sets `workspaceId` *after* the spread.
  Bodies reaching `data:` without a schema enumerate fields explicitly.
- **Public / webhook / cron route auth.** `sites/enquiry` (honeypot + per-IP and
  per-project limits), `webhooks/leads/[source]` (`requireIngressAuth`, fails
  closed in production), `whatsapp/webhook` and `payments/upi/webhook` (HMAC),
  `cron/whatsapp-drain` (constant-time `CRON_SECRET`), `auth/whatsapp/callback`
  (signed state + nonce cookie + `preview.userId !== session.user.id`). The
  `/api/v1/tenants/[tenantId]/rag/*` routes verify the API key against the
  workspace resolved from the path, so `tenantId` is never trusted alone.
- **Token strength.** `WorkspaceInvite.token` and `BuyerPortalAccess.token` are
  `randomBytes(24)` with expiry; API keys are `randomBytes(24)`, sha256-hashed
  and compared in constant time; OAuth state is HMAC-signed with a single-use
  nonce. No guessable or enumerable token. (The fixed `createBuyerAccess` bug
  was the *absence of an auth check*, not token strength.)