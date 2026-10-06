# Lead Ingest — Enterprise Integration Guide

Onboard leads from ANY company (portals, aggregators, CRMs, iPaaS pipes) with
zero code change. Last updated 2026-10-06.

## 1. The contract

```
POST /api/webhooks/leads/<source-slug>?workspace=<workspace-slug>
x-estate360-ingest-key: lei_xxx        (or Authorization: Bearer lei_xxx)
Content-Type: application/json

{ "name": "Ravi Patel", "phone": "+919812345678", "budget": "80-90 Lakh", ... }
```

- `<source-slug>`: known portal (`meta`, `99acres`, `magicbricks`, `housing`,
  `nobroker`, `google`, `website`, `pabbly`, `zapier`, `indiamart`,
  `justdial`, `hubspot`, `zoho`, `salesforce`, `oracle_cx`) **or any company
  slug** matching `[a-z0-9][a-z0-9_-]{1,40}` — e.g. `acme-crm`,
  `lobello_estates`. Custom slugs are stored uppercased (`ACME_CRM`) and score
  like a generic pipe (6 pts) until tuned.
- `?workspace=<slug>` is routing, never auth. The header is the credential.
- Always returns `200` after auth so portals never retry-storm; failures are
  recorded on `WebhookEvent` (processedAt=null) for replay via
  `POST /api/admin/leads/replay?workspace=<slug>`.

## 2. Onboard a new company (ops, no deploy)

1. Settings → API & Webhooks → **Create secret** (ADMIN). Copy `lei_xxx` once.
2. Give the partner the endpoint + secret + this field guide.
3. Keep **auto-ack OFF** until they confirm numbers are opt-in.
4. Send a test lead, verify Contact + Deal(INQUIRY) + 3 follow-up Activities.
5. Rotate via **Rotate secret** when staff/vendors change.

## 3. Payload field guide (aliases probed in order)

| Field | Aliases |
|---|---|
| name | name, full_name, fullName, customer_name, lead_name, first_name+last_name, contact_name, client_name, buyer_name, applicant_name |
| phone | phone, mobile, mobile_number, phone_number, contact_number, phoneNumber, contact_no, customer_phone, whatsapp, whatsapp_number |
| email | email, email_address, emailAddress, customer_email |
| project | project, project_name, property, listing, property_name, campaign_name |
| config | config, bhk, unit_type, configuration, property_type, bedrooms — `3BHK`, `2 bhk`, `villa`, `plot`, `shop`, `office` |
| locality | locality, location, area, city, preferred_location, zone |
| intent | intent, purpose, lead_type, enquiry_type, interest_level |
| budget | budget, budget_range, price_range, expected_budget, max_budget, price — `"80-90 Lakh"`, `"1.2 Cr"` |
| id | lead_id, leadId, id, external_id, enquiry_id, prospect_id, record_id (else sha1 fallback) |

Nested wrappers are unwrapped one level: `{ lead: {...} }`, `{ data: {...} }`,
`{ contact: {...} }`, `{ form_response: {...} }`, Zapier/Pabbly bodies.

## 4. Examples

**Generic company (Acme CRM):**
```bash
curl -X POST "https://<host>/api/webhooks/leads/acme-crm?workspace=<slug>" \
  -H "x-estate360-ingest-key: lei_xxx" -H "Content-Type: application/json" \
  -d '{"record_id":"ACME-1042","contact_name":"Asha Shah","mobileNumber":"+919820012345","expected_budget":"55-70 Lakh","unitType":"2BHK","preferredLocation":"Bopal"}'
# -> Contact(Asha Shah, ACME_CRM, scored) + Deal(INQUIRY) + 3 follow-ups
```

**Zapier / Pabbly catch-hook:**
```bash
curl -X POST "https://<host>/api/webhooks/leads/zapier?workspace=<slug>" \
  -H "x-estate360-ingest-key: lei_xxx" -H "Content-Type: application/json" \
  -d '{"data":{"full_name":"Ravi Patel","phone":"+919812345678","project_name":"Sun Residency"}}'
```

## 5. What happens per lead (worker)

1. Dedupe on `WebhookEvent.dedupeKey = SOURCE:externalId`
2. Score 0–100 (`modules/leadIngest/scoring.ts`)
3. Route ROUND_ROBIN / TERRITORY (`routing.ts`)
4. Find-or-create Contact by phone|email + workspace
5. Create Deal(INQUIRY) in first pipeline stage
6. Timeline Activity + **AI follow-ups** (hot [1,3,7]d / warm [2,5,10]d / cold [3,7,14]d, source=agent)
7. Optional WhatsApp auto-ack — requires `trusted + autoAck opt-in`
8. DPDP audit Activity — basis stated, not asserted

## 6. AI in the workflow (post-ingest)

- Contact/deal pages: `getNextBestActions()` ranks CALL/WHATSAPP/SITE_VISIT/NUDGE/CLOSE.
- One-click `createFollowUps()` for manual re-cadence.
- `draftMessage(intent)` templates, LLM-swappable via `OPENAI_API_KEY`.
- `analyzeCall(transcript)` extracts budget/config/sentiment → update Contact.
- `/ai` page: revenue/collections forecast + `askPipeline()` NL queries.
- RAG: grounded answers over brochures/price-sheets via `modules/rag`.
