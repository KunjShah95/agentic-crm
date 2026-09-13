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

Full architecture, diagrams, and data model: [`docs/architecture/system-design.md`](docs/architecture/system-design.md).

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
  UPI reconciliation.
- **Field & partner** — GPS-verified site visits, channel-partner (broker) scoping
  and commission rules, and the NAAR association network (pooled leads, listing
  exchange, referral ledger).
- **Growth** — multi-source lead ingestion, public project micro-sites, social
  connections, and unified WhatsApp / SMS / email messaging.
- **Buyer portal** — token-scoped external access to units, cost sheets, payment
  schedules, and documents.
- **Ops** — Stripe billing with plan limits, DPDP compliance, document generation,
  and reporting (funnel / inventory / collections / ROI) with CSV + PDF export.

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
  giving defense-in-depth tenant isolation the application can't accidentally bypass.
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
   → reports (funnel / collections / ROI)
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

Log in with the seed account: `demo@estate360.com` / `password123` (workspace `/acme`).

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
plus Stripe, Twilio/WhatsApp, and Redis keys to enable those integrations.

## Project structure

```
app/
  (auth)/            login + signup
  (app)/[workspace]/ dashboard, contacts, deals, organizations, projects,
                     bookings, site-visits, channel-partners, association,
                     documents, reports, inbox, search, settings, tasks
  (marketing)/       product, pricing, contact, privacy, terms
  (public)/sites/    public project micro-sites
  buyer/[token]/     buyer portal
  invite/[token]/    invite acceptance
  api/               auth, v1, webhooks, billing, payments, sites, cron, compliance
modules/             domain modules (contacts, deals, property, booking, payments, …)
lib/                 db, auth, permissions, supabase clients, validators, usage
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
