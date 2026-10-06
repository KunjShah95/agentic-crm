# Partner Onboarding Template

Fill in this template and send it to your account manager to complete integration setup.

---

## 1. Partner Information

| Field | Value |
|---|---|
| Company name | <!-- e.g. Acme CRM --> |
| Contact person | <!-- e.g. Ravi Patel --> |
| Contact email | <!-- e.g. ravi@acme.com --> |
| Contact phone | <!-- e.g. +919812345678 --> |
| Source slug (desired) | <!-- e.g. acme-crm --> |
| Estimated leads / month | <!-- e.g. 500 --> |

---

## 2. Payload Template

Copy the JSON below and replace placeholder values with your actual field names.
The system probes common aliases automatically — use the mapping table in section 3
to check whether your field names are recognized.

```json
{
  "name": "{{customer_full_name}}",
  "phone": "{{customer_phone}}",
  "email": "{{customer_email}}",
  "project": "{{interested_project}}",
  "config": "{{unit_type}}",
  "locality": "{{preferred_location}}",
  "intent": "{{lead_intent}}",
  "budget": "{{budget_range}}",
  "id": "{{your_lead_id}}"
}
```

### Nested wrapper (if your system wraps payloads)

```json
{
  "lead": {
    "name": "{{customer_full_name}}",
    "phone": "{{customer_phone}}",
    "email": "{{customer_email}}",
    "project": "{{interested_project}}",
    "config": "{{unit_type}}",
    "locality": "{{preferred_location}}",
    "intent": "{{lead_intent}}",
    "budget": "{{budget_range}}",
    "id": "{{your_lead_id}}"
  }
}
```

---

## 3. Field Mapping Table

Map your field names to our canonical fields. If a field is not listed, it will
be probed by the alias list below.

| Canonical field | Common aliases we accept | Your field name |
|---|---|---|
| name | name, full_name, fullName, customer_name, lead_name, first_name+last_name, contact_name, client_name, buyer_name, applicant_name | <!-- e.g. customer_name --> |
| phone | phone, mobile, mobile_number, phone_number, contact_number, phoneNumber, contact_no, customer_phone, whatsapp, whatsapp_number | <!-- e.g. mobile --> |
| email | email, email_address, emailAddress, customer_email | <!-- e.g. email_address --> |
| project | project, project_name, property, listing, property_name, campaign_name | <!-- e.g. property_name --> |
| config | config, bhk, unit_type, configuration, property_type, bedrooms | <!-- e.g. bhk --> |
| locality | locality, location, area, city, preferred_location, zone | <!-- e.g. area --> |
| intent | intent, purpose, lead_type, enquiry_type, interest_level | <!-- e.g. lead_type --> |
| budget | budget, budget_range, price_range, expected_budget, max_budget, price | <!-- e.g. budget_range --> |
| id | lead_id, leadId, id, external_id, enquiry_id, prospect_id, record_id | <!-- e.g. record_id --> |

### Config value normalisation

We accept the following config values and map them to canonical codes:

| You send | We store |
|---|---|
| 1BHK, 1 bhk, 1-bhk, 1RK | BHK1 |
| 2BHK, 2 bhk, 2-bhk | BHK2 |
| 3BHK, 3 bhk, 3-bhk | BHK3 |
| 4BHK, 4 bhk, 4-bhk | BHK4 |
| 5BHK, 5 bhk | BHK4 |
| villa, villas, bungalow | VILLA |
| plot, plots, land, na_plot | PLOT |
| shop, shops, retail | SHOP |
| office, offices, commercial | OFFICE |

### Budget format

Budget strings are parsed into min/max rupee values:

| You send | We store |
|---|---|
| "80-90 Lakh" | budgetMin: 8000000, budgetMax: 9000000 |
| "1.2 Cr" | budgetMin: 12000000, budgetMax: 12000000 |
| "5000000" | budgetMin: 5000000, budgetMax: 5000000 |

---

## 4. Test Commands

Replace `<host>`, `<workspace-slug>`, and `lei_xxx` with your actual values.

### Test 1: Simple flat payload

```bash
curl -X POST "https://<host>/api/webhooks/leads/<source-slug>?workspace=<workspace-slug>" \
  -H "x-estate360-ingest-key: lei_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "phone": "+919812345678",
    "email": "test@example.com",
    "project": "Test Project",
    "config": "2BHK",
    "locality": "Test Locality",
    "intent": "buy",
    "budget": "50-70 Lakh",
    "id": "TEST-001"
  }'
```

### Test 2: Nested wrapper payload

```bash
curl -X POST "https://<host>/api/webhooks/leads/<source-slug>?workspace=<workspace-slug>" \
  -H "x-estate360-ingest-key: lei_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "lead": {
      "full_name": "Test User",
      "mobile": "+919812345678",
      "email_address": "test@example.com",
      "property_name": "Test Project",
      "bhk": "3BHK",
      "area": "Test Locality",
      "lead_type": "buy",
      "budget_range": "80-90 Lakh",
      "record_id": "TEST-002"
    }
  }'
```

### Test 3: Verify ingestion

After sending test payloads, verify in the CRM:

1. Go to **Contacts** — confirm the test contact appears
2. Go to **Deals** — confirm a deal in INQUIRY stage was created
3. Go to **Activities** — confirm 3 follow-up activities were scheduled
4. Check **Settings → API & Webhooks → Events** — confirm `processedAt` is set

---

## 5. Onboarding Checklist

- [ ] Partner fills in section 1 (Partner Information)
- [ ] Partner fills in section 2 (Payload Template) with their field names
- [ ] Partner fills in section 3 (Field Mapping Table) — verify all fields map
- [ ] Ops creates ingest key: **Settings → API & Webhooks → Create secret**
- [ ] Ops shares endpoint + key + this guide with partner
- [ ] Partner sends test payload (Test 1 or Test 2 above)
- [ ] Ops verifies contact, deal, and activities created correctly
- [ ] Ops confirms dedupe works (send same payload twice — should not duplicate)
- [ ] Ops enables auto-ack if partner has opt-in confirmation
- [ ] Partner sends live payload
- [ ] Ops monitors first 24h of events for errors
- [ ] Schedule key rotation reminder (90 days)

---

## 6. Common Gotchas

### Field name mismatches

- **Symptom**: Contact created but phone/email is empty
- **Cause**: Field name not in our alias list
- **Fix**: Add the field name to the mapping table above and notify ops to update `modules/leadIngest/normalize.ts`

### Nested wrappers

- **Symptom**: Payload accepted but no fields extracted
- **Cause**: Wrapper key not recognized (we only unwrap one level)
- **Fix**: Ensure wrapper key is one of: `lead`, `data`, `contact`, `payload`, `form_response`, `formResponse`, `body`, `query`, `record`, `fields`

### Config values not mapping

- **Symptom**: Config field is empty after ingestion
- **Cause**: Value not in our config map (e.g. "2.5 BHK" or "Penthouse")
- **Fix**: Use standard values (1BHK–5BHK, villa, plot, shop, office) or request a config map update

### Budget parsing failures

- **Symptom**: Budget min/max are null
- **Cause**: Non-standard format (e.g. "80L-90L" or "80 to 90 lacs")
- **Fix**: Use standard format: "80-90 Lakh", "1.2 Cr", or raw number

### Duplicate leads

- **Symptom**: Same lead ingested multiple times
- **Cause**: Missing or inconsistent `id` field
- **Fix**: Always include a stable `id` field; dedupe key is `SOURCE:externalId`

### Phone format issues

- **Symptom**: Contact not created or merged incorrectly
- **Cause**: Phone number in non-standard format
- **Fix**: Send phone as E.164 format (`+919812345678`) or with country code

### Authentication failures

- **Symptom**: 401 or 403 response
- **Cause**: Missing or invalid ingest key
- **Fix**: Include header `x-estate360-ingest-key: lei_xxx` or `Authorization: Bearer lei_xxx`

### Workspace not found

- **Symptom**: 404 response
- **Cause**: Incorrect workspace slug in URL
- **Fix**: Verify `?workspace=<slug>` matches the workspace slug exactly (case-sensitive)
