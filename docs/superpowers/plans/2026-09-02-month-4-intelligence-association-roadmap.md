# Month 4 — Intelligence, Association & Growth (Prioritized Roadmap)

> Derived from the 2026-09 competitive analysis of Gujarat/India RE CRMs (Sell.Do, DaeBuild, Realatic, PropFlo, NeeN, HomeLead). M1–M3 reached **feature parity** with Realatic/DaeBuild. M4 is where we **differentiate** — parity features (reports) are necessary but do not win deals. Priority ranks by moat strength, not spec order.

**Positioning thesis:** Win on (a) NAAR **association network** (no competitor is association-native), (b) **agentic AI** (Gujarat-direct players have none), (c) **Gujarati-vernacular** (nobody owns it), (d) **transparent INR pricing + speed** (incumbent weakness). Do NOT try to out-feature DaeBuild on demand letters — that ground is taken.

---

## Priority ladder

| Pri | Wave | Why | Competitive rationale |
|-----|------|-----|-----------------------|
| **P0** | Agentic AI | Frontier; local players have 0 | PropFlo "Ask Jarvis" is the only benchmark; Realatic stops at 0–100 scoring |
| **P0** | NAAR association network | Structural moat, network effects | No competitor is association-native multi-tenant |
| **P1** | Reports + exports | Table stakes for demos | Everyone ships funnel/ROI/collections dashboards |
| **P1** | Gujarati/Hindi vernacular | Niche nobody owns | Sell.Do does regional but Pan-India, not Gujarat-deep |
| **P1** | Makanify Sites + Buyer portal | Growth loop (enquiry→scored lead) | Realatic/NeeN have buyer portal; we need parity + public listing |
| **P2** | WhatsApp UPI collection | Beats DaeBuild reminders with actual payment | Nobody closes letter→link→receipt loop natively |
| **P2** | Mobile PWA (offline/push/GPS) | Field agents, poor networks | Table stakes for on-ground CP/sales |
| **P2** | Platform/compliance (DPDP export, /api/v1, Tally CSV) | Enterprise trust + integrations | Bolt-on for incumbents; native for us |

---

## Phase 4.1 — Agentic AI (P0)  ·  `modules/ai`, `modules/agents`
Build on existing `calcLeadScore` + `modules/agents`.
- **AI next-best-action** — `suggestActions(deal|contact)` → ranked actions with reasoning strings (call/WhatsApp/site-visit/nudge). Pure ranking over score + stage + recency + last activity. TDD.
- **Follow-up scheduler** — `scheduleFollowUps(contact)` → creates Activity `scheduledAt` from cadence rules per lead score band. TDD.
- **AI drafting** — `draftMessage({intent, contact, unit})` → WhatsApp/email body via template + LLM stub (mock when no key), reuses shortcodes.
- **Call analysis (stub)** — `analyzeCall(transcript)` → `{ budgetMin, budgetMax, config, possessionMonths, sentiment }` extractor; regex/heuristic now, LLM-swappable. TDD.
- **"Ask your pipeline"** — `askPipeline(workspaceId, q)` → structured query over deals/contacts/inventory (Jarvis parity). Scoped, read-only.
- **Forecast** — `revenueForecast` / `collectionForecast` from Payment schedule + stage probability. TDD.
- **Acceptance:** AI suggests 3 follow-ups with reasoning; call analysis fills requirementsJson.

## Phase 4.2 — NAAR Association Network (P0)  ·  `modules/association`
Cross-workspace, association-scoped (new tenant boundary above workspace).
- **Member directory** — association → member workspaces; opt-in profile.
- **Shared lead pool** — leads a builder can't service → pool → other members claim (audit + consent preserved). Schema: `AssociationLead` or flag on Contact + `poolStatus`.
- **Inventory exchange** — members list Units to a shared grid; CP/other builders view allocated inventory (reuse `cpScopeFilter` pattern at association level).
- **Referral ledger** — cross-member referral → CommissionRule split.
- **Acceptance:** builder A pools a lead → builder B claims → both see audit; A's units visible in association grid.
- **NOTE:** biggest moat — needs schema design for the association tenant layer. Design doc before code.

## Phase 4.3 — Reports + Exports (P1)  ·  `modules/reports`
Pure aggregation functions first (testable, no DB), then query bindings + UI.
- `funnel(workspaceId)` — stage counts + conversion %.
- `inventoryHealth` — AVAILABLE/HOLD/BOOKED/SOLD mix, aging holds.
- `collections` — DUE/PAID/OVERDUE totals, overdue aging buckets.
- `sourceROI` — leads/bookings/revenue by LeadSource.
- `teamVsTarget` — per-owner bookings vs target.
- Excel (SheetJS) + PDF export.
- **Acceptance:** dashboard matches Excel for 1 project.

## Phase 4.4 — Vernacular (P1)  ·  `next-intl`, WhatsApp templates
- WhatsApp template registry: `gu` + `hi` variants of lead_ack/cost_sheet/visit_reminder.
- UI i18n scaffold (en default, gu/hi dictionaries) for booking/inbox/sites.
- Gujarati doc template variants (demand/allotment).

## Phase 4.5 — Sites + Buyer Portal (P1)  ·  `modules/sites`, `(public)/sites`
- Public listing `(public)/sites/[workspace]/[project]` syncing AVAILABLE Units.
- Enquiry form → `processLead` (source WEBSITE) → scored lead.
- Buyer portal (magic link `BuyerPortalAccess`): payment schedule, construction progress, documents.

## Phase 4.6 — WhatsApp UPI Collection (P2)
- Demand letter → Razorpay payment link in WhatsApp → webhook → Payment PAID + receipt doc. Closes DaeBuild's reminder-only gap.

## Phase 4.7 — Mobile PWA + Platform (P2)
- PWA offline queue (localStorage→sync), FCM push, image compression.
- DPDP/RERA audit export (CSV of PII view/consent trail).
- `/api/v1/*` API keys, Tally CSV export, Zapier.

---

## Build order (dependency-aware)
1. **4.3 Reports** (fast parity win, unblocks demos) →
2. **4.1 Agentic AI** (differentiator, builds on scoring) →
3. **4.2 Association** (moat, needs design doc) →
4. **4.4 Vernacular** + **4.5 Sites/Portal** (growth) →
5. **4.6 UPI** + **4.7 PWA/Platform** (polish).

TDD throughout: pure engines first (funnel/forecast/next-best-action/analyzeCall) → actions → UI. Workspace-scoped + association-scoped filters on every query.
