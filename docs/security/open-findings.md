# Open security findings — tenant isolation review

Status as of commit `6f3e1d6`. These were found in the same review that produced
the fixes in that commit. Ordered by severity. Each entry names the file and the
specific claim, so it can be re-verified or fixed without redoing the review.

**Update — broker scoping (MEDIUM-HIGH) is now fixed, and the surface has been
fully triaged.** The seven unwrapped read paths listed below were closed: every
tenant read now takes a `ViewerScope` (`lib/permissions.ts`) instead of a bare
`workspaceId`, so the unscoped signature is unrepresentable. A second pass then
read and closed the 20 read paths that had been recorded as unreviewed, and a
third found that **outbound WhatsApp send was unscoped** even though every inbox
read was correct. See "Broker scoping — closed" at the foot of this file.

The remaining entries below are still open.

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

**CLOSED.** Retained as the origin of the current design; see "Broker scoping —
closed" below.

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

## MEDIUM — Outbound WhatsApp was not broker-scoped

**CLOSED.** Found and fixed while restoring the parked WhatsApp integration.

`sendWhatsAppMessage` (`modules/whatsapp/actions.ts`) verified workspace
membership and then passed the caller-supplied `contactId` straight to
`sendOutboundWhatsAppMessage`, which looks the contact up as
`{ id: contactId, workspaceId }`. Every inbox *read* was broker-scoped, so this
was easy to miss: the reads were correct and the write path was not.

**Why it matters more than a read leak.** A Next.js server action is a public
HTTP endpoint on the app — it does not require the UI that scopes it. So a BROKER
could invoke the action directly with any `contactId` in the tenant and:

1. send an **outbound** WhatsApp message, from the company's own business number,
   to a real customer's phone, with no UI and no human confirmation;
2. do so in a way that cannot be undone — reading another broker's rows leaves a
   log, the message is delivered;
3. put the tenant's Meta account at risk, which `production-readiness.md` already
   records as a WhatsApp-policy ban risk on *that customer's* account.

The action now resolves the caller's `ViewerScope` and looks the contact up
through `brokerContactScope` before calling the outbox. The refusal is reported as
`CONTACT_NOT_FOUND`, not a permission error, because a distinct "forbidden" code
would confirm the contact exists and turn the action into an oracle for
enumerating another broker's book.

Locked down by `tests/unit/whatsapp-outbound-scope.test.ts` (8 tests), which
asserts on the *refusal* — the guarantee is that the action never reaches the
outbox for a contact the caller cannot see.

Note the pre-existing controls in this path that were already sound and are left
alone: `optedOut`, missing phone, and the 24-hour reply window are all enforced
in `modules/comms/outbox.ts`, not just in the composer UI.

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

---

## Broker scoping — closed

The MEDIUM-HIGH finding above is fixed. Recorded here because the shape of the
fix matters more than the seven call sites.

### What changed

The seven read paths took `workspaceId: string`, and `brokerScopeFilter` needs a
role to do anything. With no role in scope the filter had nothing to act on, so
each query was workspace-wide *by construction* — not by oversight in the body,
which is why it survived review seven times.

So the signature changed instead of the body:

- `ViewerScope` (`lib/permissions.ts`) carries `workspaceId` **and** `role`
  **and** `brokerId`. Every tenant read path now takes it, so the unscoped
  signature can no longer be written. The compiler found all 19 call sites.
- `resolveViewerScope(workspaceId, userId)` resolves role and broker id in one
  place and returns `null` for a non-member, so pages keep their `notFound()`
  behaviour without repeating the membership lookup inline.
- `brokerContactScope` was added for `Contact`, which has **no `brokerId`
  column**. `brokerScopeFilter` returns `{ brokerId }` and cannot be spread into
  a `ContactWhereInput`; contacts reach a broker through
  `deals: { some: { brokerId } }`.

Fail-closed throughout: a `BROKER` with no linked `Broker` row gets
`__no_broker__`, matching nothing.

Also closed while in these paths:

- `exportContactsCsvAction` raised `pageSize` to 1000, so it was the widest leak
  in the app — a BROKER's "Export CSV" returned every contact in the tenant
  regardless of what the table above it showed.
- `app/(app)/[workspace]/ai/page.tsx` had no membership `notFound()` gate, unlike
  every other page in the app, and its two forecast queries were unscoped.
- `getDealDetail` carries the broker predicate **in the lookup**, so a foreign
  deal reads as not-found and cannot be probed for existence.
- `getContactDetail` scopes the nested `deals` relation as well as the parent
  row; scoping only the parent would still expose every deal on a shared contact.

### What is now enforced

Two suites, deliberately separate:

| Suite | Asserts |
| --- | --- |
| `tests/unit/broker-scope-registry.test.ts` | Every tenant read path in `modules/**/queries.ts` has a recorded broker-visibility decision, and entries claiming `"scoped"` really call a filter helper. |
| `tests/unit/broker-scope-reads.test.ts` | The predicate that reaches Prisma carries the broker id, and is absent for every other role. |

`tests/unit/search-queries.test.ts` covers the raw-SQL case separately: the
broker predicate there is hand-written SQL, and a structural check cannot see it
because it is interpolated as a `Prisma.sql` fragment rather than appearing in
the template's static chunks. A test that joined only those chunks would call a
scoped query unscoped.

The registry also carries a **`unreviewed`** state and a baseline count, so the
surface nobody has looked at yet is printed on every run instead of being
silently absent. It ratchets: the count may fall, never rise. Run
`npx vitest run tests/unit/broker-scope-registry.test.ts` to see the outstanding
list.

**The baseline is now 0 — all 43 tenant read paths are classified.** Each is
either `scoped` (with the predicate asserted behaviourally) or `workspace-wide`
with a stated reason, and the suite fails if a `workspace-wide` entry has an
empty reason or if a new read path appears unregistered.

### Second pass — the remaining surface

The 20 paths that were still `unreviewed` have now been read and closed. Eight
were live leaks:

| Read path | What it disclosed |
| --- | --- |
| `search::searchWorkspace` | The ⌘K palette returned every contact (with email) and deal in the tenant. Widest surface in the product, reachable from any page. |
| `whatsapp::listInboxContacts` / `…ByChannel` | Every conversation in the tenant, with phone numbers **and the `optedOut` DPDP consent flag**. |
| `whatsapp::getContactTimeline` | Full message bodies for any contact id in the tenant. |
| `whatsapp::getReplyContext` | Phone, opt-out state, and the 24h reply-window clock. |
| `organizations::getOrganizationDetail` | Every contact and deal on any organization the broker looked up. |
| `reports::getPipelineByStage` / `getDealsByOwner` / `getWinRateByDealType` | Tenant-wide pipeline value, per-owner totals, and a win rate whose denominator was the whole tenant. |
| `siteVisits::listSiteVisits` | Lead name and phone, free-text notes, outcome, and the GPS fix of every visit. |

Two defects beyond simple missing scoping:

- **`reports::getSourceROI` had a query with no `workspaceId` at all** —
  `db.contact.findMany({ where: { id: { in: contactIds } } })`. The ids come
  from a workspace-scoped deal set, so it was safe *by derivation*, but a foreign
  `contactId` is accepted on deal create and update (the MEDIUM finding below),
  and one such deal would have disclosed another tenant's contact `leadSource`.
  Derivation is not a boundary; the predicate is now explicit.
- **`reports::getReportsSnapshot` forwarded `role`/`brokerId` to five of its
  eight sub-queries** and passed the workspace id alone to the other three. All
  eight now receive the same `ViewerScope`.

Seven are workspace-wide by design, with the reason recorded: the four
`association::` queries (a pooled lead is *supposed* to be visible across the
association — that is the NAAR network feature, and the workspace boundary is
enforced upstream by `getAssociationForWorkspace`), `organizations::
listOrganizations` and `documents::listTemplates` (shared master data),
`reports::getInventoryHealth` (`Unit` has no `brokerId`, so filtering would
silently redefine the metric), and `reports::getTeamVsTarget`'s member directory
(a broker must see the team to hand a lead to — only the booking counts filter).

Three pages were also missing the `notFound()` membership gate that every other
page has (`site-visits`, `documents`, `organizations/[id]`), and four inline
`db.contact.findMany` contact-picker queries in pages were unscoped.

### Still open

1. **NEW — `documents::listGeneratedDocuments` cannot be scoped without a
   migration.** `renderedHtml` is a full deal document (buyer, unit, payment
   figures) and should be broker-scoped, but `GeneratedDocument.dealId` is a
   bare column with **no `@relation` to `Deal`** (`Deal` has no back-relation
   either), so there is nothing to filter through in the Prisma layer. Two ways
   to close it:
   - add `deal Deal? @relation(fields: [dealId], references: [id])` to
     `GeneratedDocument` plus the matching list on `Deal`, then filter the
     relation exactly as `siteVisits::listSiteVisits` does. Smallest diff.
   - denormalise `brokerId` onto `GeneratedDocument` at generation time. Faster
     to filter, but must be kept in sync when a deal changes broker.

   Recorded in the registry as `workspace-wide` with this reason so the gap is
   visible rather than assumed safe.

2. **Contact visibility for a BROKER.** `brokerContactScope` currently means "a
   contact attached to one of my deals". A freshly imported or reassigned lead —
   not yet on a deal — is therefore invisible on `/contacts`, and the same rule
   now applies to the inbox and to outbound send. If brokers are meant to work a
   raw lead list, the intended rule is probably "contacts they own"
   (`Contact.ownerId`), which needs the caller's userId threaded alongside the
   role. Both are defensible; this is a product call. Worth deciding before the
   broker role is used in anger, because the rule now gates sending as well as
   reading.

The HIGH finding above (no RLS backstop) is untouched by this work and remains
the larger risk.