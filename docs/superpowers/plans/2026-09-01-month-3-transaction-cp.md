# Month 3 — Transaction & CP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:test-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Hold→Booking→Demand letter without Excel; CPs see only allocated inventory.

**Deliverables:** Booking wizard (hold→KYC→bank→booking), CLP/milestone plans auto-attach to Deal, site-visit scheduling + GPS check-in, demand/allotment/receipt/possession generation (shortcodes {{rera_no}}, {{carpet_area}}, {{total}}, {{milestone}}), e-sign adapter (Leegality/Digio stub), CP onboarding + scoped visibility + CommissionRule per booking, Deal kanban RE stages (Inquiry→Visit→Negotiation→Hold→Booking→Registration→Possession→Closed).

**Acceptance:** Book 1 unit → 8 CLP milestones auto-created → demand letter #1 → CP sees only allocated units → commission calc.

**Existing (from M1/M2):** Project/Tower/Floor/Unit, CostSheet, PaymentPlan/PaymentMilestone/Payment, DocumentTemplate/GeneratedDocument, Deal{unitId,paymentPlanId,bookingStage,costSheetId}, documents/shortcodes, costSheet/calc. **Missing:** SiteVisit, ChannelPartner, CommissionRule; Role SALES/CP/VIEWER; PaymentMilestone dueTrigger/daysAfter; scoped CP queries; booking/payments/documents/siteVisits/channelPartners modules.

---

## File Structure

**Create:**
- `modules/booking/stages.ts` — RE_STAGES order, `canTransition`, `nextStage`, `isBookingStage`
- `modules/booking/actions.ts` — `holdUnit`, `startBooking`, `recordKyc`, `confirmBooking` (auto CLP + demand #1)
- `modules/payments/clp.ts` — `generateCLP(total, milestones[])` → amounts; pure
- `modules/payments/actions.ts` — `attachPaymentPlan(dealId, planId)` materializes Payment rows
- `modules/channelPartners/commission.ts` — `computeCommission(dealValue, {pct?, amount?})`; pure
- `modules/channelPartners/queries.ts` — CP-scoped Unit/Deal queries (`where cpId`)
- `modules/channelPartners/actions.ts` — `onboardCp`, `assignCommission`
- `modules/siteVisits/gps.ts` — `haversineMeters`, `withinRadius`; pure
- `modules/siteVisits/actions.ts` — `scheduleVisit`, `checkIn` (GPS + Activity channel SITE_VISIT)
- `modules/documents/render.ts` — `buildDocContext({deal,unit,costSheet,workspace})`, `renderDocument(template, ctx)`
- `modules/documents/esign.ts` — `requestSignature` stub (Leegality/Digio), mock when no creds
- Tests per module under `tests/unit`, integration `tests/integration/booking-flow.test.ts`

**Modify:**
- `prisma/schema.prisma` — add SiteVisit, ChannelPartner, CommissionRule; Role +SALES/CP/VIEWER; PaymentMilestone +dueTrigger,daysAfter; Deal + cpId?; relations
- `lib/validators/re.ts` — siteVisitSchema, channelPartnerSchema, commissionSchema, bookingSchema, paymentPlanSchema
- `lib/permissions.ts` — CP scope helper `cpScopeFilter(role, cpId)`
- `app/(app)/[workspace]/bookings`, `/site-visits`, `/channel-partners`, `/documents` pages + Deal kanban

---

### Task 1: Schema delta + validators + RE stages
Add SiteVisit/ChannelPartner/CommissionRule, Role enum ext, PaymentMilestone fields, Deal.cpId. `npx prisma validate && generate`. Validators + `RE_STAGES`. Test: schema contains models; stages ordered.

### Task 2: CLP generation (pure)
`generateCLP(total, [{label,pct}...])` → `[{label, pct, amount}]`, amounts sum to total (last milestone absorbs rounding). 8-milestone default template. Test: sum==total, count==8.

### Task 3: Booking stage machine (pure)
`RE_STAGES` order; `canTransition(from,to)` forward-only (+ reopen to CLOSED guard); `nextStage`. Test: INQUIRY→VISIT ok, skip ok, backward blocked.

### Task 4: Commission calc (pure)
`computeCommission(dealValue, {pct?, amount?})` → amount (explicit amount wins, else pct*value), clamp ≥0. Test.

### Task 5: Site-visit GPS (pure)
`haversineMeters(a,b)`, `withinRadius(a,b,m)`. Test: same point 0m, ~known distance, radius bool.

### Task 6: Document render (pure)
`buildDocContext` maps deal/unit/costSheet/workspace → shortcode dict; `renderDocument` fills template, asserts no `{{` left for required codes. Test demand letter.

### Task 7: Actions + CP scope + wizard/kanban (DB/UI)
booking/payments/siteVisits/channelPartners actions, `cpScopeFilter`, booking wizard, Deal RE kanban, documents page. Integration: book→8 milestones→demand #1→CP scoped.

---

## Self-Review
Spec M3 coverage: wizard→T3+T7, CLP→T2+T7, site-visit GPS→T5+T7, docs→T6+T7, e-sign stub→T7, CP scoped+commission→T4+T7, kanban→T3+T7. Pure engines (T2-T6) first, DB/UI (T7) after. Workspace-scoped + CP filter every query.
