# Pilot runbook — the commands

**Date:** 2026-10-03 · Sell-side detail in [`offer.md`](offer.md) · discovery
in [`prospecting.md`](prospecting.md)

This is the operator's checklist for the weeks after a signature. It exists
because the setup labour *is* the product being sold, and doing it from memory
means the second customer costs the same as the first.

---

## Before you start

```bash
npx next build && npx next start -p 3000     # or your deployed URL
npm run pilot:verify                          # 13 checks, throws away its own data
```

`pilot:verify` must pass before you quote inbound lead capture to anyone. It
proves an unauthenticated POST is refused and an authenticated one lands a
scored, routed lead — over real HTTP, against the real database.

> **Flag caveat:** npm 11 drops `--flags` from `npm run … -- …`. Pass options
> with `npx tsx scripts/provision-pilot.ts --flag value`, or set `PILOT_BASE_URL`.

---

## Week 0 — baseline, before you touch anything

- [ ] Export their last 90 days of enquiries from whatever they use now.
- [ ] Count: source, received time, first response time, outcome, lost reason.
- [ ] Agree **one** success criterion, in writing.
- [ ] Get the inventory spreadsheet and the open-leads list.

Do not skip this. The before-half of the case study cannot be reconstructed
later, and a pilot with no agreed success criterion cannot be defended at
renewal.

---

## Week 1 — provision and load

Fill in [`inventory-template.csv`](inventory-template.csv) from their sheet.
Columns: `project,tower,floor,unitNo,config,carpet,builtUp,facing,price,status`.
`tower`/`floor` can be blank; `config` accepts `3 BHK` or `BHK3`.

```bash
npx tsx scripts/provision-pilot.ts \
  --client "Shilp Infra" \
  --slug shilp-infra \
  --owner-email owner@client.in \
  --owner-name "Hemal Shah" \
  --password "<generated>" \
  --rera "PR/GJ/AHMEDABAD/…/RAA09876/010623" \
  --inventory ./shilp-inventory.csv
```

This creates the workspace, the owner login, the six-stage pipeline
(Enquiry → Site Visit → Hold → Booking → Won/Lost), imports inventory, mints
the lead-ingest secret, and prints the handoff sheet.

**Re-running is safe.** Adding a tower or correcting a price just re-runs the
command; the ingest secret is *not* rotated, because silently invalidating a
live customer's webhook is exactly the failure that reads as "our leads
stopped arriving". Pass `--rotate-secret` when you actually want a new key, and
update the portal before removing the old one.

Import their open leads last, so nothing looks lost on day one.

## Week 2 — connect the sources

- [ ] Paste the webhook URL + key into each portal (Meta, 99acres, MagicBricks).
- [ ] Confirm one test lead arrives per source.
- [ ] `--auto-ack` is **off** by default. Turn it on only after confirming the
      customer's sources are ones where the enquirer gave their number in good
      faith. To enable later, re-run with `--auto-ack`.
- [ ] Connect their WhatsApp Business number; approve message templates.
- [ ] Model WhatsApp per-conversation cost into the invoice. India pricing
      changed 1 Oct 2026; a 200-enquiry broker with six follow-ups is ~1,200
      conversations a month.

## Week 3 — the team

- [ ] One named salesperson, 45 minutes, on **their own** leads.
- [ ] One-page card: "what happens when a lead arrives", in their floor language.
- [ ] They run it; you watch and fix.

## Day 3 check-in

Fifteen minutes, not a launch party. What broke, what did they not do, and is
the success criterion still the right number?

---

## Verification, any time

```bash
npx tsx scripts/verify-ingress.ts http://localhost:3000
```

Thirteen checks: refused unauthenticated, refused wrong key, nothing written by
refused calls, accepted authenticated, contact materialized, scored, deal
created and routed, no outbound while auto-ack is off, dedupe holds on resubmit
(no second contact, no second deal), outbound happens once opted in. It creates
and deletes its own workspace.

Run this after touching ingress code, before a demo, and whenever a customer
says leads "sometimes don't arrive" — it distinguishes their portal's problem
from ours.

---

## Offboarding

- [ ] Export contacts, deals and inventory to CSV and hand it over.
- [ ] `--rotate-secret`, and tell them their old key stops working now.
- [ ] Leave the workspace until they ask. Deleting a customer's data without
      being asked is the fastest way to never get a referral.