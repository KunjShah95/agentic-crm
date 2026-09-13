# Estate360

A multi-tenant real-estate CRM for builders, brokers, and sales teams. Estate360
runs the full sales lifecycle — lead capture, contact and deal management,
project inventory, cost sheets and payment plans, bookings, site visits, channel
partners, buyer portal, billing, and reporting — on a shared-schema
multi-tenant architecture where every query is scoped to a `workspaceId`.

**Stack:** Next.js 16 (App Router, RSC) · TypeScript · Prisma 7 · PostgreSQL
(Supabase, `pgvector`) · NextAuth v5 (email/password + optional Google) ·
Supabase Storage · Redis (Upstash) · Stripe · Twilio / WhatsApp / Unipile ·
shadcn/ui · Tailwind v4 · Vercel-ready.

Full architecture, diagrams, and data model:
[`docs/architecture/system-design.md`](docs/architecture/system-design.md).

## Features

- **Auth & multi-tenancy** — email/password (optional Google), workspace
  auto-created on signup, invite links with roles (Owner / Admin / Member /
  Broker); every query filtered by `workspaceId` with a three-layer isolation
  model (app gate → query scoping → Postgres RLS backstop).
- **CRM core** — contacts, organizations (with email-domain auto-link), deals on
  a drag-and-drop kanban (stage changes auto-logged), unified activity timeline,
  tags, and workspace-scoped full-text search.
- **Inventory & transactions** — projects → towers → floors → units, cost-sheet
  and payment-plan engine, bookings, and milestone-based payment collection with
  UPI webhook reconciliation.
- **Field & partner** — GPS-verified site visits, channel-partner (broker) scoping
  and commission rules, and the NAAR association network (pooled leads, listing
  exchange, referral ledger).
- **AI** — next-best-action suggestions, meeting scheduler, message drafting,
  call analysis, revenue and collections forecasting, and a workspace-wide
  `/ask` pipeline grounded in CRM data.
- **RAG / knowledge base** — tenant-isolated document Q&A over your own
  documents: ingestion with per-format parsers (text, PDF, DOCX, image, audio,
  video), chunking, 1024-dim embeddings (`pgvector`), hybrid retrieval with
  reranking, an agentic answer loop, confidence + faithfulness gates, exact and
  semantic caching, and a feedback loop. Exposed as a REST API under
  `/api/v1/tenants/[tenantId]/rag/*` and degrades to deterministic mock
  providers when API keys are absent — see
  [RAG configuration](#rag-configuration).
- **Growth** — multi-source lead ingestion (webhooks + public micro-site
  enquiries), public project micro-sites, social connections, and unified
  WhatsApp / SMS / email messaging.
- **Buyer portal** — token-scoped external access to units, cost sheets, payment
  schedules, and documents (including generated PDFs).
- **Ops** — Stripe billing with plan limits and usage metering, DPDP compliance,
  document generation, and reporting (funnel / inventory / collections / ROI)
  with CSV + PDF export.

## Why Supabase

Supabase provides the **database and storage**; application **auth is NextAuth v5**
backed by the same Postgres. Rationale:

- **Standard Postgres, no lock-in.** Prisma connects with a plain
  `@prisma/adapter-pg` connection string, so the same code runs on Supabase,
  Neon, or self-hosted Postgres by swapping `DATABASE_URL`. A normalized CRM with
  deep relations (deal → unit → cost sheet → payment plan → payment) needs real
  SQL joins and foreign keys — ruling out Firestore-style document stores and
  MySQL forks that drop FKs.
- **Batteries included.** Managed Postgres, object Storage, `pgvector`, native
  Row-Level Security, and a serverless-friendly connection pooler come from one
  vendor and one dashboard — fewer moving parts for a small team than stitching
  a DB host + S3 + a pooler.
- **RLS as a safety net.** Postgres RLS backs the app-layer `workspaceId` filter,
  giving defense-in-depth tenant isolation the application can't accidentally
  bypass. The RAG tables are covered by their own RLS migration.
- **Auth stays in our tables.** NextAuth keeps identity, membership, and role
  (`WorkspaceMember`) as first-class relational rows the CRM already joins
  against, avoiding a sync loop with an external auth directory.

Neon is a supported drop-in alternative — Supabase is the default for bundling
Storage, `pgvector`, RLS, and pooling in one place.

## User flow

```
Marketing → Sign up → workspace auto-created (Owner) → invite team
   → capture lead → Contact → Deal (pipeline) → activities + site visit
   → pick Unit → Cost Sheet + Payment Plan → Booking (unit → Booked)
   → collect payments per milestone (UPI webhook) → generate documents
   → AI suggestions / RAG Q&A over documents → reports (funnel / collections / ROI)
```

Buyers get a token-scoped `/buyer/[token]` portal; brokers (role `BROKER`) see
only their own allocated deals and units and earn commission via `CommissionRule`.
See the [diagrams](docs/architecture/system-design.md#8-user-flows) for the full flows.

## Getting started

```bash
npm install
```

1. **Database** — create a Supabase project (or use Neon). Copy the Postgres
   connection string into `.env`:

   ```bash
   cp .env.example .env
   # paste your Supabase connection string as DATABASE_URL
   ```

2. **Auth secret** — generate one:

   ```bash
   npx auth secret
   ```

3. **Migrate & seed**:

   ```bash
   npm run setup        # prisma migrate dev + prisma db seed
   ```

4. **Run**:

   ```bash
   npm run dev          # http://localhost:3000
   ```

Log in with the seed account created by `npm run setup` (see `prisma/seed.ts`).

## RAG configuration

The RAG module works out of the box with deterministic mock providers — useful
for development and CI. Add provider keys to `.env` and flip the provider env
vars to light up real models. All knobs are optional and read from `RAG_*`
environment variables at module load:

| Area | Env vars | Default behavior |
| --- | --- | --- |
| Embeddings | `RAG_EMBED_PROVIDER` (`jina` or unset), `JINA_API_KEY` | Deterministic hash-based mock, 1024 dims |
| Answer LLM | `RAG_LLM_POOL` (comma list of `groq,gemini,mistral,nvidia`), `GROQ_API_KEY`, `GEMINI_API_KEY` / `GEMINI_MODEL`, `MISTRAL_API_KEY`, `NVIDIA_API_KEY` | Extractive mock answer from top chunks |
| Reranking | `JINA_API_KEY` (Jina reranker), `COHERE_API_KEY` (Cohere rerank) | Skipped; fused hybrid score used as-is |
| Vision / STT | `GEMINI_API_KEY` | Image and audio parsers degrade gracefully |
| Retrieval | `RAG_ALPHA` (hybrid weight), `RAG_POOL`, `RAG_HYDE`, `RAG_HIERARCHICAL`, `RAG_QUERY_EXPANSION`, `RAG_TEMPORAL_DECAY`, `RAG_AUTHORITY_WEIGHTING`, `RAG_MULTI_VECTOR` | Sensible defaults; advanced strategies opt-in |
| Chunking | `RAG_CHUNK_WORDS`, `RAG_CHUNK_OVERLAP` | ~380 words, 50 overlap |
| Caching | `RAG_CACHE_TTL`, `RAG_CACHE_SIMILARITY` | Exact cache 1h; semantic cache 24h @ 0.85 similarity |
| Limits | `RAG_MAX_FILE_BYTES`, `RAG_EMBED_CONCURRENCY`, `RAG_EMBED_BATCH` | 50 MB, 4 concurrent, batch 32 |
| Quality gates | `RAG_CONFIDENCE_MIN`, `RAG_FAITHFULNESS_MIN`, `RAG_FRESHNESS_HALFLIFE` | 0.65 / 0.8 / ~2 years |

> **Mixing vectors is corrupting:** embeddings are only comparable within one
> model. If you switch `RAG_EMBED_PROVIDER` (mock ↔ Jina), reindex the corpus
> (`POST /api/v1/tenants/[tenantId]/rag/reindex`) before querying.

The ingest→query pipeline is: parse → chunk → embed → hybrid retrieve (vector +
keyword) → rerank → agentic answer loop → confidence/faithfulness gates → exact
+ semantic cache → feedback. REST surface:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/tenants/[tenantId]/rag/documents` | Ingest a document |
| `GET/DELETE /api/v1/tenants/[tenantId]/rag/documents/[id]` | Fetch / remove a document |
| `POST /api/v1/tenants/[tenantId]/rag/bulk` | Bulk ingest |
| `POST /api/v1/tenants/[tenantId]/rag/query` | Ask a question (grounded, cited answer) |
| `POST /api/v1/tenants/[tenantId]/rag/sync` | Sync documents from storage |
| `POST /api/v1/tenants/[tenantId]/rag/reindex` | Re-embed the corpus |
| `POST /api/v1/tenants/[tenantId]/rag/feedback` | Submit answer feedback (thumbs / comments) |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Create/apply dev migrations |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio |

## Environment variables

See `.env.example`. `DATABASE_URL` and `AUTH_SECRET` are required. Add
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` for Google OAuth, Supabase
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Storage,
plus Stripe, Twilio/WhatsApp, and Redis keys to enable those integrations. RAG
provider keys are optional and env-gated — see
[RAG configuration](#rag-configuration).

## Project structure

```
app/
  (auth)/            login + signup
  (app)/[workspace]/ dashboard, contacts, deals, organizations, projects,
                     bookings, site-visits, channel-partners, association,
                     documents, reports, inbox, ai, tasks, settings
  (marketing)/       product, pricing, contact, privacy, terms
  (public)/sites/    public project micro-sites
  buyer/[token]/     buyer portal
  invite/[token]/    invite acceptance
  api/               auth, v1 (contacts + tenant RAG), webhooks, billing,
                     payments, sites, cron, compliance, admin
modules/             domain modules — contacts, deals, property, booking,
                     payments, reports, ai, rag, search, …
lib/                 db, auth, permissions, supabase clients, validators,
                     logger, usage
components/          shadcn/ui primitives + feature components
prisma/              schema, migrations, seed
docs/architecture/   system design + diagrams
```

## Deployment (Vercel)

1. Push to GitHub and import into Vercel (Fluid Compute, Node runtime).
2. Add `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, and any integration keys to
   project env vars.
3. Run `npm run db:deploy` once against the production database.
4. Deploy. (No code changes needed to switch between Supabase and Neon.)

> **Note on `pgvector`:** the `RagChunk.vector(1024)` column is declared
> `Unsupported` in the Prisma schema, so embedding reads/writes go through
> raw SQL helpers inside `modules/rag` — keep that in mind if you touch
> Prisma-level queries against RAG tables.
