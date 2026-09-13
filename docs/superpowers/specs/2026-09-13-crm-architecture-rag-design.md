# CRM System Architecture + RAG Remediation — Design Spec

**Date:** 2026-09-13
**Project:** Estate360 CRM (`C:\crm`) — multi-tenant Real-Estate NA CRM
**Stack:** Next.js 16 (App Router) · Prisma 7 · PostgreSQL + pgvector · Supabase (Auth/Storage/DB) · Redis (Upstash) · NextAuth v5 · Stripe · Twilio/WhatsApp/Unipile
**Reference:** `C:\multitenantsaas\TenantOps-architecture.md` (style + rigor model)

## Goals

Two deliverables, sequenced doc-first:

1. **Architecture document** — a `TenantOps`-style system-design doc for the whole CRM, with the RAG subsystem covered in depth. Mermaid diagrams + module inventory + tenancy model, all grounded in the actual codebase (file:line references, no invention).
2. **RAG remediation** — make `modules/rag` compile (38 TypeScript errors today), pass one end-to-end ingest→query smoke test with mock providers, then verify a real-provider run once keys are added to `.env`.

Non-goals (YAGNI): no new RAG features, no refactor of unrelated modules, no test suite beyond the smoke test + one real-provider run, no infra changes.

## Current State (verified)

- **App:** Next.js App Router. Route groups: `(app)` workspace shell, `(auth)`, `(marketing)`, `(public)`, `buyer`, `invite`. Workspace pages under `app/(app)/[workspace]/*` (contacts, deals, projects, bookings, inbox, documents, site-visits, reports, ai, association, …).
- **API:** `app/api/v1/{contacts,tenants}`. RAG is live-wired at 7 routes: `app/api/v1/tenants/[tenantId]/rag/{query,documents,documents/[id],bulk,sync,reindex,feedback}/route.ts`.
- **Domain modules (26):** `agents, ai, association, billing, booking, brokers, buyerPortal, comms, compliance, contacts, costSheet, deals, documents, email, leadIngest, organizations, payments, platform, property, rag, reports, search, sites, siteVisits, sms, social, whatsapp`.
- **Data model (Prisma):** Workspace/User/WorkspaceMember/WorkspaceInvite (tenancy); Contact/Organization/Deal/Activity/PipelineStage/Tag (CRM core); Project/Tower/Floor/Unit/CostSheet/PaymentPlan/PaymentMilestone/Payment (inventory + transactions); SiteVisit/Broker/CommissionRule; Association/AssociationMember/AssociationLead/AssociationListing/Referral (shared pool); BuyerPortalAccess; Subscription/PlanLimits/UsageEvent/UsageCounter (billing/usage); SocialConnection/SocialEvent/WebhookEvent; DocumentTemplate/GeneratedDocument; **RagDocument / RagChunk / RagFeedback / RagQueryLog**.
- **Tenancy:** `workspaceId` (aka `tenantId` in RAG routes) scopes every query. `lib/permissions.ts` for RBAC (`Role` enum: OWNER/ADMIN/MEMBER + RAG adds VIEWER). RLS migration present (`prisma/migrations/20260913000001_enable_rag_rls`), Supabase-compat migration present.
- **RAG pipeline (exists, does not compile):** `ingest → parsers (text/image/audio/video ffmpeg) → chunk → embed (Jina v3, 1024-dim; deterministic mock fallback) → RagChunk.vector(1024) → hybrid retrieve (vector + keyword, alpha) → rerank (Cohere) → agentic answer loop (LLM pool: Groq/Gemini/Mistral/NVIDIA + extractive mock) → confidence + faithfulness gates → exact + semantic cache → feedback`. Config via `RAG_*` env vars. Provider keys (`JINA/GROQ/GEMINI/MISTRAL/NVIDIA/COHERE/HF/SARVAM`) are env-gated and **not yet in `.env`** — the module is built to degrade to mock and light up real providers when keys appear.

## Deliverable 1 — Architecture Document

**Path:** `docs/architecture/estate360-architecture.md` (committed, mermaid-rendered).

Sections (each grounded with `file:line`):

1. **Overview** — shared-schema multi-tenant CRM; `workspaceId` gating; App Router server actions + `/api/v1` REST surface; RLS as defense-in-depth.
2. **High-level system context** (mermaid `graph TB`) — Client (Next.js RSC + client shells) → Route handlers / Server Actions → domain modules → Data (Postgres/pgvector, Supabase Storage, Redis) → externals (Stripe, Twilio, WhatsApp, Unipile, RAG provider APIs).
3. **Request lifecycle & tenant isolation** (mermaid `graph LR`) — auth (NextAuth v5 session / API), workspace resolution from `[workspace]`/`[tenantId]`, membership + role check, `WHERE workspaceId = …` re-scope, cross-tenant → 404. Note RLS backstop.
4. **Data model** (mermaid `erDiagram`) — grouped: tenancy, CRM core, inventory/transactions, brokers/visits, association, billing/usage, documents, **RAG**.
5. **RAG subsystem — deep dive** — dedicated `graph TB` of the pipeline above + a `sequenceDiagram` for ingest and for query (incl. cache hit/miss, confidence/faithfulness gates, agentic retry loop). Data model for the 4 Rag* tables. Provider strategy + env matrix. Failure/degradation modes.
6. **Module inventory** — table: module → path → responsibility → tenancy guard.
7. **Deployment & scaling path** — Vercel (Fluid Compute) + Supabase pooler + Upstash Redis; RAG ingest as background work; scaling notes.
8. **Notes & recommendations** — including the RAG remediation summary (links to Deliverable 2).

## Deliverable 2 — RAG Remediation

**Error inventory (38, from `tsc --noEmit`):** `ingest.ts` (23), `answer.ts` (8), `chunk.ts` (4), `providers/llm.ts` (2), `retrieve.ts` (1).

**Fix strategy (by root cause — exact fixes finalized during plan/execution after reading each file):**

- **`ingest.ts` (23):** dominant causes — (a) Prisma `metadata` typed as `Record<string,unknown>` but the column expects `InputJsonValue`; cast/serialize to Prisma JSON input. (b) `number` passed where `string` expected (id/hash arg mismatches) — fix call sites/signatures. (c) `embedding` not in `RagChunkSelect` — the `vector(1024)` column is `Unsupported` in Prisma, so reads/writes of embeddings must go through **raw SQL** (`$queryRaw`/`$executeRaw`), not the typed client. Standardize a small helper for vector read/write.
- **`answer.ts` (8):** two unrelated `DocMeta` types collide (`modules/rag` vs generated Prisma) → unify to one `DocMeta` and adapt; `string | null` → `string | undefined` normalization at boundaries; `created_at: Date | null` handling.
- **`chunk.ts` (4):** `Section.lines`/`body` optional-vs-required mismatch → make the `Section` shape consistent and guard `possibly undefined`.
- **`providers/llm.ts` (2):** typing on `runPool` generator/return union.
- **`retrieve.ts` (1):** single type mismatch, fix at site.

**Verification (evidence required before claiming done):**
1. `npx tsc --noEmit` → zero `modules/rag` errors.
2. Smoke test: ingest a small text doc + one query through a route (or a direct module call) with **mock** providers → returns an answer with a citation, no throw. Capture output.
3. Real-provider run: with keys in `.env` (`RAG_EMBED_PROVIDER=jina` + `JINA_API_KEY`, an LLM key e.g. `GROQ_API_KEY`), repeat → real embedding + generated answer with citation. Capture output.

## Sequencing & Risks

- **Order:** write architecture doc (needs only reading) → then code fix (doc informs the RAG section, which documents the intended-correct shapes). Each is its own plan/execution cycle.
- **Risk — pgvector via Prisma:** `Unsupported("vector(1024)")` means embeddings can't use the typed client; raw SQL is required and must stay `workspaceId`-scoped. This is the crux of the `ingest.ts` fixes.
- **Risk — mock/real embedding mixing:** never persist mock vectors then query with real ones (incomparable). Document + guard: pin one embedding model per workspace/corpus; a provider switch implies reindex.
- **Risk — provider keys absent at test time:** smoke test uses mock explicitly; real-provider run is gated on keys the user supplies.

## Success Criteria

- Architecture doc committed, renders, and every claim maps to real code.
- `modules/rag` compiles clean; smoke test passes with captured evidence; real-provider run captured once keys are present.
