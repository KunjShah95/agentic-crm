# Agentic CRM — Phase 1: Core CRM Design

**Date:** 2026-08-07  
**Scope:** Phase 1 of 3 — Core CRM foundation  
**Stack:** Next.js 15 (App Router) + TypeScript, Prisma + Postgres, NextAuth v5, shadcn/ui + Tailwind v4, Vercel

---

## Project Overview

Multi-tenant SaaS CRM targeting solo founders, freelancers, and small sales teams. Designed to support AI agents in Phase 2. Phase 1 delivers the full CRM data layer, auth, and UI — no AI features yet, but the architecture is structured to plug them in without rewrites.

**Phase roadmap:**
- **Phase 1 (this spec):** Core CRM — contacts, deals, pipeline, multi-tenant auth, team roles
- **Phase 2:** AI Agents — outreach, lead research, scheduling, qualification, summarization
- **Phase 3:** SaaS layer — billing, plan limits, usage metering, admin portal

---

## Architecture

```
Next.js 15 App Router (TypeScript)
├── /app
│   ├── (auth)/               — login, signup pages
│   ├── (app)/[workspace]/    — slug-based workspace routing
│   └── api/auth/[...nextauth]/
├── /modules
│   ├── contacts/             — contact CRUD, timeline, notes
│   ├── deals/                — pipeline, stages, deal cards
│   ├── organizations/        — companies linked to contacts
│   ├── activities/           — emails, calls, meetings, tasks log
│   └── agents/               — stub module for Phase 2 agent runners
├── /lib
│   ├── db.ts                 — Prisma client singleton
│   ├── auth.ts               — NextAuth config
│   └── permissions.ts        — role-based access checks
└── /components               — shared UI (shadcn/ui primitives)
```

**Infrastructure:**
- Database: Postgres — Neon (recommended for Vercel-native integration) or Supabase; resolved at deploy time, no code changes required between the two
- ORM: Prisma
- Auth: NextAuth v5 (email/password + Google OAuth)
- UI: shadcn/ui + Tailwind v4
- Deploy: Vercel

**Multi-tenancy model:** Workspace-based. Every resource belongs to a workspace. Users can be members of multiple workspaces with distinct roles. All DB queries filter by `workspaceId` — no cross-tenant data leakage.

---

## Data Model

Relation fields abbreviated (`@relation(...)`) for readability — full Prisma schema generated during implementation.

```prisma
model Workspace {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  plan      String   @default("free")
  createdAt DateTime @default(now())
  members   WorkspaceMember[]
  contacts  Contact[]
  deals     Deal[]
  orgs      Organization[]
  stages    PipelineStage[]
  activities Activity[]
  invites   WorkspaceInvite[]
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  avatarUrl String?
  createdAt DateTime @default(now())
  memberships WorkspaceMember[]
}

model WorkspaceMember {
  workspaceId String
  userId      String
  role        Role     @default(MEMBER)
  workspace   Workspace @relation(...)
  user        User      @relation(...)
  @@id([workspaceId, userId])
}

enum Role { OWNER ADMIN MEMBER }

model WorkspaceInvite {
  id          String   @id @default(cuid())
  workspaceId String
  email       String
  role        Role
  token       String   @unique
  expiresAt   DateTime
  accepted    Boolean  @default(false)
}

model Contact {
  id             String   @id @default(cuid())
  workspaceId    String
  firstName      String
  lastName       String
  email          String?
  phone          String?
  linkedinUrl    String?
  jobTitle       String?
  organizationId String?
  createdBy      String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deals          Deal[]
  activities     Activity[]
  tags           ContactTag[]
}

model Organization {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  domain      String?
  industry    String?
  size        String?
  website     String?
  createdAt   DateTime @default(now())
  contacts    Contact[]
  deals       Deal[]
}

model PipelineStage {
  id          String  @id @default(cuid())
  workspaceId String
  name        String
  order       Int
  color       String
  deals       Deal[]
}

model Deal {
  id               String    @id @default(cuid())
  workspaceId      String
  title            String
  contactId        String?
  organizationId   String?
  stageId          String
  value            Float?
  currency         String    @default("USD")
  probability      Int?
  expectedCloseDate DateTime?
  ownerId          String
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  activities       Activity[]
  tags             DealTag[]
}

model Activity {
  id          String       @id @default(cuid())
  workspaceId String
  type        ActivityType
  contactId   String?
  dealId      String?
  body        String?
  scheduledAt DateTime?
  completedAt DateTime?
  createdBy   String
  createdAt   DateTime     @default(now())
}

enum ActivityType { NOTE EMAIL CALL MEETING TASK }

model Tag {
  id          String @id @default(cuid())
  workspaceId String
  name        String
  color       String
  contacts    ContactTag[]
  deals       DealTag[]
}

model ContactTag {
  contactId String
  tagId     String
  @@id([contactId, tagId])
}

model DealTag {
  dealId String
  tagId  String
  @@id([dealId, tagId])
}
```

---

## Auth & Multi-Tenancy

**Routing:** `/(app)/[workspace]/` — workspace slug in URL. Session stores `userId` + `activeWorkspaceId`.

**Signup flow:**
1. User creates account → `User` row created
2. First workspace created automatically → `WorkspaceMember` (role: OWNER) created
3. Redirected to `/<workspace-slug>/contacts`

**Invitation flow:**
1. Owner/admin sends invite by email → `WorkspaceInvite` row (token, role, expiresAt)
2. Recipient clicks link → signs up or logs in → invite consumed → `WorkspaceMember` created

**Permission enforcement:**  
Every server action and API route calls `requireWorkspaceMember(workspaceId, userId, minRole?)` before any data access. Fails with 403 — never silently succeeds.

**Role matrix:**

| Action | MEMBER | ADMIN | OWNER |
|---|:---:|:---:|:---:|
| View/edit contacts, deals, orgs | ✓ | ✓ | ✓ |
| Invite members | | ✓ | ✓ |
| Delete workspace data | | ✓ | ✓ |
| Billing / delete workspace | | | ✓ |

---

## Core Modules

### Contacts
- List: searchable, filterable (tag, org, owner), sortable, paginated
- Detail: contact info + unified activity timeline + linked deals
- Bulk actions: tag, assign owner, export CSV

### Organizations
- Company profile with linked contacts and deals
- Auto-link suggestion: if contact email domain matches org domain, prompt to link

### Deals / Pipeline
- **Kanban view:** drag-drop cards between stages
- **Table view:** sortable list with value, age, owner, stage
- Stage changes auto-logged as `Activity` entries
- Deal detail: full activity timeline, linked contacts, notes

### Activities
- Unified timeline per contact and per deal
- `NOTE`, `EMAIL`, `CALL`, `MEETING` logged manually in Phase 1 (Phase 2 auto-captures)
- `TASK` type: has due date + assignee, surfaces in global "My Tasks" view

### Search
- Global search across contacts, orgs, deals — workspace-scoped
- Postgres full-text search (`tsvector` columns) — no external search service

### UI Shell
- Left sidebar: workspace switcher, nav links, user avatar
- Command palette (`⌘K`): quick navigation + search
- shadcn/ui components throughout; dark mode supported via Tailwind

---

## Error Handling

- Server actions return `{ data, error }` union — never throw to client
- API routes return typed error objects with correct HTTP status codes
- `requireWorkspaceMember` failure → 403 response, not redirect
- DB errors caught at module boundary, logged server-side, generic message surfaced to client
- All inputs validated with Zod at API boundary before hitting DB

---

## Testing Strategy

- **Unit:** pure functions — permission checks, data transforms, stage ordering logic
- **Integration:** Prisma queries against real test Postgres DB (no mocks — mock/prod divergence is a known failure mode)
- **E2E (Playwright):** critical paths — signup, workspace invite, create contact, create deal, move pipeline stage, global search

---

## Phase 2 Stub

`/modules/agents/` created but empty in Phase 1. Exports a `runAgent(type, workspaceId, payload)` stub that logs + no-ops. Phase 2 replaces internals without changing the call signature used elsewhere.

Activity logging interface designed to accept `source: 'manual' | 'agent'` from day one — agents write the same activity rows, just with a different source flag.

---

## Out of Scope (Phase 1)

- AI agent execution
- Email sending / calendar integration
- File attachments
- Billing / plan enforcement
- Public API
- Mobile app
