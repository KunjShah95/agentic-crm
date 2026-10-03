# Offer, pricing and pilot terms

**Date:** 2026-10-03 · Companion to
[`docs/strategy/pressure-test.md`](../strategy/pressure-test.md)

Two products, two names, two price ladders. The single most common way to lose
a services deal is to let the prospect see the self-serve price and then hear
the services price as though they were the same thing.

---

## The two offers

### Estate360 (self-serve — unchanged)

Published on `/pricing`, from **₹1,499/month**, 14-day trial, no card. The
buyer logs in and does it themselves. Free trial is a real workspace, not a
read-only demo. This is the long tail and the SEO/AEO surface. **Do not
discount it to win a managed deal — it teaches the market that the software
is cheap and the labour is what you are really charging for.**

### Estate360 Managed (pilot)

Same software, plus our labour, plus an outcome. This is what gets sold to an
Ahmedabad builder or brokerage over WhatsApp in the first 30 days.

| | Pilot | Standard |
| --- | --- | --- |
| Setup | ₹25,000 | ₹60,000 |
| Monthly | ₹5,000 | ₹12,000 |
| Term | 60 days | annual |
| Included seats | 5 | 15 |

**Pilot terms, stated up front:** the setup fee is credited against the first
year if they continue. If we miss the written success criterion, the monthly
charge for the second month is waived.

The success criterion is agreed in writing before any work starts, and it is
one number, drawn from their own data. Examples: "every site visit logged
with a GPS photo", "zero enquiries unassigned for more than 2 working hours",
"every confirmed booking has a cost sheet and a demand letter". Not "increase
conversions" — a number they can check in week eight.

---

## What "Managed" actually includes

Being specific here is the whole product. A vague promise ("we set up your
CRM") is indistinguishable from the ₹15,000 WhatsApp shop.

### Week 0 — baseline (before we change anything)

- Export and count their last 90 days of enquiries from whatever they use now.
- Record: source, received time, first response time, outcome, lost reason.
- This becomes the before-half of the case study. It is a deliverable, and it
  is the reason the case study is credible rather than anecdotal.
- Written success criterion agreed and countersigned.

### Week 1 — data in

- Import contacts, inventory (project → tower → floor → unit) from their
  spreadsheet. One-time CSV import wizard already exists for contacts.
- Re-create units, carpet area, price, status, and RERA number per project.
- Import or connect their existing open leads so nothing looks "lost" on day
  one — a migration that appears to lose data kills more pilots than any bug.
- Set up pipeline stages to match how they *actually* talk, not ours.

### Week 2 — pipeline live

- Connect lead sources: Meta lead forms, 99acres / MagicBricks exports,
  website enquiry form on their micro-site, walk-in.
- Issue a lead-ingest secret so inbound webhooks are authenticated rather
  than open, and turn on WhatsApp auto-ack **only if** their sources are ones
  where the enquirer gave their number in good faith.
- WhatsApp Business number connected; message templates approved.
- Note for whoever prices it: WhatsApp per-conversation cost changed for India
  on 1 Oct 2026. Model the monthly messaging cost into the quote — a 200-enquiry
  broker with six follow-up touches is ~1,200 conversations a month, and if
  that is not in the price the margin is a guess.

### Week 3–4 — the team

- One salesperson trained, on their own leads, in a 45-minute session. Named
  person, not "the team".
- Written one-page "what happens when a lead arrives" card, in the language
  they use on the ground.
- They run it. We watch. We fix.

### Explicitly not included

- Outbound lead generation or cold outreach on their behalf.
- Meta ad spend management.
- Website or brochure design.
- Migration from a system we have never seen, beyond one spreadsheet.
- Guaranteed revenue or conversion lift. Anyone promising that in real estate
  is guessing, and a builder can tell.

---

## Objection handling

**"We already use WhatsApp."**
Yes, and it stays — this is not an anti-WhatsApp product. WhatsApp is where
buyers talk. The problem is that WhatsApp is a place conversations go to die:
no stage, no owner, no record of who replied. Nothing is being replaced;
something is being written down. Ask: when a salesperson quits, what happens
to last quarter's enquiries? That question usually ends the conversation.

**"We already have a CRM" / "we tried one."**
Which parts does your team actually open, and when did they last open it?
Most "we have a CRM" answers mean they have a database nobody reads. If they
genuinely use one well, that is a disqualifier, not a sale — say so and walk.

**"It's expensive."**
It is ₹25,000 against a sales team that touches maybe ₹1Cr of inventory a
year. One recovered booking pays for it. Ask what their average ticket is and
do the division out loud. If their volume is too small to support it, say so
— a pilot that fails on economics costs more than one that never started.

**"My team won't use it."**
Then the pilot has already failed and we should not start. Insist on the
named person and the 45 minutes. The most common cause of a failed rollout is
that it was sold to the owner and never to the person who has to type.

**"Send me details / send a proposal."**
Send one page and ask for 20 minutes. A proposal is a way to avoid a call.
Every serious buyer expects to be shown the thing.

**"Is our data safe?"**
Point at the architecture: every query scoped to a workspace, Postgres RLS as
a second layer, DPDP consent flow, CSV export on demand, workspace never
deleted without an explicit request. Do not read this from a slide; let them
log in and look.

---

## The demo

A live demo of *their* data beats any seed data. Sequence:

1. **Their project, their units.** Show inventory and a real cost sheet.
2. **The document.** Generate an allotment or demand letter with their RERA
   number. This is the moment a builder understands the difference — it is
   the part no lead bot can do, and it usually ends the pitch.
3. **The lead.** Post a lead into their pipeline and watch it score and route.
4. **The gap.** Ask: when an enquiry arrives at 11pm, who sees it, and what
   happens if they don't reply? Let them answer.
5. **The cost.** Ask what they currently spend on follow-up and tooling.

An existing script is at `docs/video/demo-script.md`; update it, since it
still describes auto-ack as automatic.