# Loop CRM

A multi-tenant SaaS CRM for solo founders, freelancers, and small sales teams.
Phase 1 delivers the full CRM data layer, auth, and UI — architecture is ready
for AI agents in Phase 2.

**Stack:** Next.js 16 (App Router) · TypeScript · Prisma 7 · PostgreSQL
(Supabase/Neon) · NextAuth v5 (email/password + optional Google) · shadcn/ui ·
Tailwind v4 · Vercel-ready.

## Features (Phase 1)

- **Auth** — email/password signup & login, workspace auto-created on signup,
  invite links with roles (Owner / Admin / Member)
- **Multi-tenancy** — slug-based workspace routing, every query filtered by
  `workspaceId`, per-role permission checks on every server action
- **Contacts** — searchable/filterable/sortable list, detail page with unified
  activity timeline, tags, linked deals, bulk tag / assign owner / export CSV
- **Deals** — kanban board with drag-and-drop (stage changes auto-logged as
  activity), sortable table view, pipeline stats, stage management
- **Organizations** — company profiles with linked contacts/deals and
  auto-link suggestions by email domain
- **Activities** — notes, emails, calls, meetings, and tasks on every record;
  "My Tasks" view
- **Search** — workspace-scoped Postgres full-text search
- **Shell** — sidebar with workspace switcher, `⌘K` command palette, dark mode

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
   npm run setup        # runs prisma migrate dev + prisma db seed
   ```

4. **Run**:

   ```bash
   npm run dev          # http://localhost:3000
   ```

Log in with the seed account: `demo@loopcrm.com` / `password123` (workspace
`/acme`).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Create/apply dev migrations |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio |

## Environment variables

See `.env.example`. Only `DATABASE_URL` and `AUTH_SECRET` are required.
Add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to enable Google OAuth.

## Project structure

```
app/
  (auth)/            login + signup
  (app)/[workspace]/ contacts, deals, organizations, tasks, search, settings
  api/auth/          NextAuth route handler
  invite/[token]/    invite acceptance
modules/             feature modules (contacts, deals, organizations, activities, agents, search)
lib/                 db, auth, permissions, validators, actions
components/          shadcn/ui primitives + feature components
prisma/              schema, migrations, seed
```

## Deployment (Vercel)

1. Push to GitHub and import into Vercel.
2. Add `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` to project env vars.
3. Run `npm run db:deploy` once against the production database.
4. Deploy. (No code changes needed between Supabase and Neon.)

## Phase 2

AI agents plug into `/modules/agents` (`runAgent(type, workspaceId, payload)`
stub). Activity rows already carry a `source: 'manual' | 'agent'` flag.
