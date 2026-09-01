# Real Estate NA CRM — Design Spec (Verticalize Loop CRM)

**Date:** 2026-09-01
**Approach:** Approach 1 — Vertical Slice → Expanded Lifecycle (4 months, 5 devs)
**Base codebase:** `C:\crm` — Loop CRM (Next.js 16, Prisma 7, PostgreSQL, NextAuth v5, workspace-scoped multi-tenancy)

## 1. Goal & Scope

Transform Loop CRM in-place into the official "Real Estate NA CRM" for NAAR (North Ahmedabad Association of Realtors) — Ahmedabad/Gujarat-first, India-scale. Covers full lifecycle: RERA launch/lead capture → scoring/routing → WhatsApp engagement → inventory → cost sheet → hold/booking → CLP/milestones → payments → demand/allotment/possession letters → CP/commission → site visits → dashboards → buyer portal → association shared pool.

Generic Loop primitives remain: Workspace (tenant), Contact, Deal, Organization, Activity, PipelineStage. RE features are additive, not forks.

**ICP (tight):** Mid-size builders (2-10 projects) + Channel Partners/brokers + NAAR association members. Solo brokers served via same tenant with fewer seats.

**Success gates (pilot exit):** 5-10 NAAR builders/CPs live, 200+ units, 500+ leads ingested, median lead→WhatsApp ack <2min, cost sheet <30s, 1 demand letter per booked unit without Excel, zero cross-workspace leak in audit, DPDP/RERA audit export passes.

## 2. Architecture

### 2.1 Stack & Conventions
- Next.js 16 App Router, TypeScript, Prisma 7 (driver adapters), PostgreSQL (Supabase/Neon), NextAuth v5, shadcn/ui, Tailwind v4, Vercel-ready — unchanged.
- Every server action: `requireWorkspaceMember(workspaceId, userId)` + CP-scoped filter where applicable. Row-level tenant isolation.
- Validation: `lib/validators/re.ts` (zod) for all RE writes. Actions via `lib/actions` with `revalidatePath`.
- Queue pattern (reuse from `modules/social`): thin webhook ingress returns 200 immediately; failure → DLQ table; worker processes async. Never 500 to provider.
- PDFs: worker-generated (react-pdf or puppeteer), stored to Supabase Storage, URL in `GeneratedDocument`.
- i18n: `next-intl` with `en` default, `gu` + `hi` dictionaries (Sites + WhatsApp templates M1, full UI M4).

### 2.2 Data Model Delta

**New models (workspace-scoped, FK cascade on Workspace delete):**

```
Project { id, workspaceId FK, name, reraNo, address, city, type: RESIDENTIAL/COMMERCIAL/PLOT, status, createdAt }
Tower { id, projectId FK, name, floors Int, createdAt }
Floor { id, towerId FK, number Int }
Unit { id, floorId FK, projectId FK, workspaceId FK, unitNo, config: 1BHK/2BHK/3BHK/4BHK/VILLA/PLOT/SHOP, area Float, carpetArea, builtUp, facing, price Float, status: AVAILABLE/HOLD/BOOKED/SOLD, createdAt, updatedAt }
CostSheet { id, unitId FK, dealId FK?, version Int, basePrice, gst, stampDuty, otherCharges Json, total, currency INR default, createdAt }
PaymentPlan { id, projectId FK, name: CLP/SUBVENTION/CUSTOM, createdAt }
PaymentMilestone { id, planId FK, label, pct Float, dueTrigger, daysAfter Int, order Int }
Payment { id, dealId FK, milestoneId FK?, amount Float, dueDate, status: DUE/PAID/OVERDUE, receiptNo, paidAt, createdAt }
DocumentTemplate { id, workspaceId FK, kind: DEMAND_LETTER/ALLOTMENT/BOOKING_FORM/RECEIPT/POSSESSION, name, bodyHtml (with {{shortcodes}}), reraAligned Bool }
GeneratedDocument { id, workspaceId FK, dealId FK?, unitId FK?, templateId FK, renderedHtml, pdfUrl, eSignStatus: PENDING/SIGNED/VOID, createdAt }
LeadSource enum: NINETY_NINE_ACRES/MAGIC_BRICKS/HOUSING/NOBROKER/META/GOOGLE/WEBSITE/WALK_IN/PABBLY
SiteVisit { id, workspaceId FK, leadId FK->Contact, unitId FK?, dealId FK?, scheduledAt, checkedInAt, gps Json?, notes, outcome, activityId FK?, createdAt }
ChannelPartner { id, workspaceId FK, name, reraNo, brokerage, userId FK? (link to User), createdAt }
CommissionRule { id, workspaceId FK, dealId FK, cpId FK, pct Float, amount Float, status: PENDING/PAID, createdAt }
BuyerPortalAccess { id, workspaceId FK, contactId FK, magicToken, expiresAt, lastSeenAt }
WebhookEvent { id, workspaceId FK?, source String, payload Json, dedupeKey String @unique, processedAt, createdAt } // reuse SocialEvent pattern
AuditLog { id, workspaceId FK, actorId, action, entity, entityId, meta Json, createdAt }
```

**Extensions to existing models:**
- Contact: + leadSource LeadSource?, leadScore Int? (0-100), requirementsJson Json? {budgetMin,max,bhk,location,intent}, kycJson Json?, consentAt DateTime?, consentSource String?, optedOut Bool @default(false)
- Deal: + unitId String? FK->Unit, paymentPlanId String? FK->PaymentPlan, bookingStage String? (INQUIRY/VISIT/NEGOTIATION/HOLD/BOOKING/REGISTRATION/POSSESSION/CLOSED), costSheetId String? FK->CostSheet; currency default INR
- Activity: + channel String? (WHATSAPP/SMS/EMAIL/CALL/SITE_VISIT), templateId String?, direction String? (IN/OUT), keep source manual|agent|system
- Workspace: + settingsJson Json? { rera, gstRate, stampDutyRate, whatsappBsp, locale }
- PlanLimits: add reMaxUnits, reStorage? (keep existing)

**Indexes:** All FK + workspaceId, dedupeKey unique, createdAt for timeline.

### 2.3 Module Map
```
app/
  (app)/[workspace]/projects       // list + detail + InventoryGrid
  (app)/[workspace]/units/[id]     // unit drawer
  (app)/[workspace]/bookings       // booking wizard (Deal RE stages)
  (app)/[workspace]/site-visits    // calendar
  (app)/[workspace]/documents      // templates + generated
  (app)/[workspace]/channel-partners
  (app)/[workspace]/reports        // dashboards
  (public)/sites/[workspace]/[project] // Makanify Sites — public listing
  api/webhooks/[source]/route.ts   // thin ingress
  api/whatsapp/webhook/route.ts    // Meta inbound
modules/
  property/        // Project/Tower/Floor/Unit
  costSheet/       // generation + versioning
  booking/         // hold→booking wizard, KYC
  payments/        // CLP/milestones/payments
  documents/       // shortcodes, render, e-sign adapter
  channelPartners/ // CP + commissions
  siteVisits/      // scheduling + GPS
  whatsapp/        // Meta Cloud adapter, templates, inbox
  leadIngest/      // worker, dedupe, scoring, routing
  ai/              // scoring 0-100, next-best-action, drafting
  reports/         // funnel, inventory health, collections, ROI
  association/     // directory, shared pool, training
  sites/           // public listing sync
worker/
  ingest.ts        // queue consumer
  whatsappRefresh.ts // token refresh
lib/
  validators/re.ts
  whatsapp.ts
  documents.ts
```

### 2.4 Permissions
Extend `lib/permissions.ts`: roles OWNER/ADMIN/MEMBER + SALES/CP/VIEWER. CP users get scoped `where: { cpId: currentCpId }` on Unit/Deal queries. Owner/Admin bypass scope. All queries filtered by `workspaceId` first.

## 3. Four-Month Waves (Approach 1)

### Month 1 — Inventory Core
**Goal:** Show & price any unit in 30s. Unblocks pilots without Excel.
**Deliverables:** Project→Tower→Floor→Unit CRUD, InventoryGrid (status colors, filters: price/config/facing/status), status transitions (AVAILABLE/HOLD/BOOKED/SOLD) logged as Activity, cost-sheet engine (base+GST+stamp+others → total, versioned, WhatsApp-ready), CSV import 200 units, RERA template stub.
**Acceptance:** Import CSV, HOLD TTL, cost sheet PDF <30s, WhatsApp share button copies formatted sheet.
**Team (5):** A schema/seed/RBAC, B Grid+Unit drawer, C CSV import, D CostSheet+PDF, E Project/Tower UI + QA.

### Month 2 — Lead Capture + Comms
**Goal:** Every portal lead in WhatsApp <4min, 2-way inbox in timeline.
**Deliverables:** Thin webhooks (99acres/MagicBricks/Housing/NoBroker/Meta/Google/Website/Pabbly) → WebhookEvent → worker dedupe (dedupeKey) + AI score 0-100 (source/intent/locality/config) + routing (round-robin/territory/source) + consent audit → Contact+Deal+Activity; Meta Cloud WhatsApp adapter (templates, 2-way, click-to-call logging), SMS/email adapters, unified inbox merged into Contact timeline.
**Acceptance:** 100 webhook posts → <4min, deduped, scored, auto-ack via WhatsApp, inbound reply creates Activity.
**Team:** A worker/DLQ/replay, B WhatsApp adapter/templates, C scoring/routing, D inbox UI + timeline merge, E webhook ingress + Pabbly generic + tests.

### Month 3 — Transaction & CP
**Goal:** Hold→Booking→Demand letter without Excel; CPs see only allocated inventory.
**Deliverables:** Booking wizard (hold→KYC→bank details→booking), CLP/milestone plans auto-attach to Deal, site-visit scheduling + GPS check-in, demand/allotment/receipt/possession generation (shortcodes: {{rera_no}}, {{carpet_area}}, {{total}}, {{milestone}}), e-sign adapter (Leegality/Digio stub), CP onboarding + scoped visibility + CommissionRule per booking, Deal kanban RE stages (Inquiry→Visit→Negotiation→Hold→Booking→Registration→Possession→Closed).
**Acceptance:** Book 1 unit → 8 CLP milestones auto-created → demand letter #1 PDF → CP sees only allocated units → commission calc.
**Team:** A booking wizard + Deal refactor, B CLP/Payments, C documents/PDF/sign, D CP+commissions+scoped queries, E site-visits + kanban.

### Month 4 — Intelligence, Reporting & Association
**Goal:** Ship "Real Estate NA CRM" — dashboards + AI + Sites + Buyer portal + NAAR.
**Deliverables:** AI: live scoring + next-best-action with reasoning + follow-up scheduling + drafting + revenue/collection forecast (via `modules/agents/runAgent`); Reports: funnel, inventory health, collections, team vs target, source ROI + Excel/PDF export; Makanify Sites: public listing site syncing Unit inventory, enquiry → scored lead; Buyer portal (magic link, payments/progress/docs); NAAR: member directory, shared lead pool/inventory exchange; Mobile PWA offline queue + push (FCM), DPDP/RERA audit export.
**Acceptance:** Dashboard matches Excel for 1 project, AI suggests 3 follow-ups with reasoning, listing enquiry creates scored lead, audit log exports DPDP trail.
**Team:** A AI/actions+forecast, B reports/dashboards+exports, C Sites + buyer portal, D association + mobile offline/push, E perf/security/docs + hardening.

## 4. Staffing & Conventions

**Ownership (8 sprints, 2-week each):**
- Dev A (Domain): Prisma, validators, seed, RBAC, AuditLog.
- Dev B (Inventory+Tx): property, booking, payments.
- Dev C (Ingest+AI): webhooks/workers/DLQ, scoring, agents.
- Dev D (Comms+Docs): whatsapp/sms/email, documents/e-sign, site-visits.
- Dev E (Growth+Platform): reports, sites, association, buyer portal, mobile PWA, QA/perf.

**Conventions:** zod validation on all writes; `revalidatePath` after mutations; never 500 to provider; workspaceId first in every query; feature-flag direct portal APIs (Pabbly/CSV unblocks M1).

**Risks:** Portal APIs paid/restricted → flag + Pabbly fallback; WhatsApp BSP approval lag → apply Day 1 M2 + mock adapter; Deal bloat → Unit is source of truth, Deal holds bookingStage only; 5-way merge → trunk-based + Dev A queues migrations.

## 5. Compliance & Integrations

**RERA:** Project.reraNo, Unit status trail, template shortcodes, Activity actor+tstamp for every transition.
**DPDP 2023:** consentAt/consentSource/optedOut, WhatsApp opt-in gate, AuditLog for PII view/export.
**TDS/GST:** CostSheet typed line items, Payment receipts with TAN placeholder, Tally/QuickBooks CSV export (no filing).
**Integrations:** M1 Pabbly/webhook+CSV, M2 Meta Cloud WA/SMS/Email/Google/Website, M3 Razorpay stub + e-sign, M4 Zapier/API keys (`/api/v1/*`), Tally CSV, direct portal APIs flagged.
**Mobile:** Offline queue (localStorage → sync), push, GPS check-in, image compression for poor networks.

## 6. Non-Goals (Deferred)
HRMS/attendance/payroll, OCR of KYC, 3D/AR/360, full accounting/ERP (export only), white-label per-builder theming beyond logo/colors, MLM multi-level commissions (single-level only in M3).

## 7. Verification Plan
- Unit tests: validators (zod), costSheet calc, scoring, routing, commission calc, shortcode render.
- Integration: webhook → worker → Contact/Deal/Activity, 2-way WA roundtrip, booking→CLP→demand letter chain.
- E2E (Playwright): import CSV → grid → cost sheet → WhatsApp share → hold→book → demand letter → CP scoped view → dashboard.
- Security: cross-workspace leak tests, CP scope tests, DPDP consent gate tests.

## 8. File-Level Change Summary
New: `prisma/schema.prisma` (6 models + 4 extensions), `lib/validators/re.ts`, `modules/{property,costSheet,booking,payments,documents,channelPartners,siteVisits,whatsapp,leadIngest,ai,reports,association,sites}/`, `app/(app)/[workspace]/{projects,units,bookings,site-visits,documents,channel-partners,reports}/`, `app/(public)/sites/`, `app/api/webhooks/*`, `worker/ingest.ts`.
Modified: `lib/permissions.ts`, `app/(app)/[workspace]/deals` (RE stages), `components/*` (InventoryGrid, Inbox).

---
*Approved 2026-09-01 — Approach 1. Ready for planning.*
