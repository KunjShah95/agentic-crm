# Plan 1 — Architecture Document — 2026-09-13

Spec: `docs/superpowers/specs/2026-09-13-crm-architecture-rag-design.md` Deliverable 1.
Target: `docs/architecture/estate360-architecture.md` (does not exist yet — `docs/` holds only `superpowers/`).

## Scope
Doc-only, no code. 8 sections per spec §Deliverable 1. Every claim gets `file:line`. Mermaid must render (graph TB, graph LR, erDiagram, sequenceDiagram).

## Grounding (verified 2026-09-13)
- Layouts: `app/layout.tsx:1`, `app/(app)/layout.tsx:1`, `app/(app)/[workspace]/layout.tsx:1`, `app/(auth)/layout.tsx:1`
- Pages (32): `(marketing)` root+product/pricing/contact/privacy/terms/thank-you; `(auth)` login/signup; `(app)/[workspace]` ai, association, bookings, channel-partners, contacts(+[id]), deals(+[id]), documents, inbox, organizations(+[id]), projects(+[projectId]), reports, search, settings(+members/billing/social), site-visits, tasks; `(public)/sites/[workspace]/[project]`; `buyer/[token]`; `invite/[token]`
- API v1 (8 files): `app/api/v1/contacts/route.ts` + 7 RAG `app/api/v1/tenants/[tenantId]/rag/{query,documents,documents/[id],bulk,sync,reindex,feedback}/route.ts`; non-v1 surface: `app/api/{auth/[...nextauth],billing/{checkout,portal},payments/upi/webhook,webhooks/{stripe,social/[provider],leads/[source]},whatsapp/webhook,...}/route.ts`
- Modules: 27 on disk under `modules/` (spec says 26 — use ground truth; spec list omits one)
- Tenancy/RBAC: `prisma/schema.prisma:13-20` (`Role`: OWNER/ADMIN/MEMBER/SALES/BROKER@map("CP")/VIEWER); `lib/permissions.ts:7` ROLE_RANK, `:9` hasMinRole, `:52` requireWorkspaceMember, `:78` brokerScopeFilter
- RLS: `prisma/migrations/20260913000001_enable_rag_rls/migration.sql:12` helper, `:56-82/:85-110/:113-137/:140-164` RagDocument/Chunk/Feedback/QueryLog policies; precursor `.../20260913000000_supabase_compat/migration.sql`
- RAG pipeline: `modules/rag/{index.ts,types.ts,validation.ts,ingest.ts:16,parsers/index.ts:20+88,parsers/video.ffmpeg.ts,chunk.ts:67-68,retrieve.ts:15-16+121+273,providers/{embeddings.ts:10,rerank.ts:9-10+95,llm.ts,vision.ts,stt.ts,http.ts},answer.ts:143,confidence.ts:7-8,faithfulness.ts:8,cache.ts:24+47+63,semantic-cache.ts:169+171-172,feedback.ts:21,queue.ts:18-19,query-enhancer.ts,query-processor.ts}`
- Env matrix: `.env.example:1-17` has zero RAG_*/provider keys; code fallbacks in `providers/embeddings.ts:12`, `providers/llm.ts:32`, `providers/rerank.ts:9-10`, `retrieve.ts:15-23`, `chunk.ts:67`, `ingest.ts:16`, `cache.ts:47`, `semantic-cache.ts:171-172`

## Tasks
1. Create `docs/architecture/estate360-architecture.md` with the 8 spec sections + diagrams (context TB, lifecycle LR, RAG pipeline TB, ingest/query sequenceDiagrams, erDiagram grouped per spec).
2. Module inventory table: module → path → responsibility → tenancy guard (cover all 27; note spec 26-vs-27 delta).
3. RAG deep-dive: pipeline stages, 4 Rag* tables (`prisma/schema.prisma:795+`), provider/env matrix, degradation modes (mock fallback, no-keys behavior).
4. Self-check: every heading has ≥1 `file:line`; mermaid blocks labeled with type; no invented files.

## Verification
- File exists at target path, committed.
- `grep -c "file:line\|:\d"` sanity + manual render check of mermaid.
- No code changes in this plan.

## Risk / note
Spec §Sequencing: doc first (read-only), then RAG fix. Doc records intended-correct RAG shapes; remediation may update the RAG section afterward.
