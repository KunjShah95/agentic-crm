# Pressure test — the 30-day plan

**Date:** 2026-10-03
**Subject:** the "AI Lead-to-CRM Automation for Indian SMBs / sell the
implementation" research, tested against what is actually in this repository.

Verdict: the diagnosis is right, the target is wrong. The plan's central
instruction — *don't build another CRM, sell the implementation* — is good
advice for someone starting from zero and actively harmful advice here,
because this repo **is** the differentiated CRM. Following it would trade away
the only asset that is hard to copy for a commodity service that a local
agency already sells at ₹15,000.

---

## 1. What the plan gets right

- **Don't build before you sell.** Correct, and this repo already has enough
  surface area to be a liability rather than an asset if it keeps growing.
- **Pick one niche and name the workflow.** Correct. "Stop losing property
  enquiries after the first message" is a positionable sentence; "we build AI
  agents" is not.
- **20 conversations, not 1,000 messages.** Correct. The plan's own list of
  questions (where leads come from, how fast they respond, who follows up,
  how many get ignored) is the right discovery instrument.
- **Price to test, not to assume.** Correct. ₹7,500–₹15,000 as a probe is
  sensible.
- **First objective is evidence, not ₹1 lakh.** Correct and underrated.

## 2. Where it goes wrong

### 2.1 It mistakes a competitor for the fight

The plan cites an Ahmedabad provider selling a "₹15,000 one-time WhatsApp AI +
CRM setup" as proof the market exists. It is — and it is also proof of the
problem: **that is the price floor of a commodity.** Orbixel is not the
competitor. A ₹15,000 WhatsApp bot shop cannot build or operate what is in
this repo, and a builder will not pay ₹15,000 for it a second time.

The actual alternatives a prospect is choosing between are: a spreadsheet, a
WhatsApp Business account used manually, and Brokertise/LeadSquared-style
horizontal CRMs that have never heard of a construction-linked payment plan.
None of them do RERA document generation, CLP milestones, cost sheets, or
GPS-verified site visits. **That is the moat, and the plan does not mention
it once.**

### 2.2 "Sell the implementation" would delete the asset

Stage 1–4 of the plan is: sell implementation → standardise → productise →
SaaS. Stages 3 and 4 are already shipped and publicly priced. The marketing
site, the pricing page, the FAQ structured data and `llms.txt` are all live
in this repo. There is no implementation to standardise — the product *is*
the standardisation.

The plan would replace a defensible ₹1,499+/mo self-serve motion with an
undifferentiated services motion that scales with your hours, not with your
code.

### 2.3 It contradicts its own niche choice

The plan names Ahmedabad real estate as niche #1, then spends three sections
proposing dental clinics, coaching institutes and interior designers as
"particularly interesting alternatives" — and the pasted prospecting output
is a Google Maps scrape of exactly those three (dental clinics, coaching
centres, interior designers), with no real-estate businesses in it.

Those alternatives are wrong for *this product*, and the reason is structural
rather than a matter of taste: the CRM's depth is real-estate-shaped. Cost
sheets, payment plans tied to construction milestones, RERA numbers on
generated documents, tower/floor/unit inventory, channel-partner commission
rules, GPS site visits. A dental clinic would touch perhaps 15% of it. You
would be demoing inventory and cost sheets to someone who wants appointment
reminders, and the demo would actively hurt.

Real estate is the correct first niche. The plan reaches a defensible
conclusion by a bad argument, and then undermines the conclusion two sections
later. Fix the reasoning, keep the niche.

### 2.4 Pricing contradicts the live pricing page

The plan proposes ₹7,500–₹40,000 one-time plus ₹3,000–₹10,000/mo. The live
page says "from ₹1,499/month". These are not two prices for one thing; they
are two different businesses, and a prospect who sees the page and then hears
the pitch concludes one of them is a lie.

Both can be true, but only if they are different products with different
names:

- **Estate360** — self-serve SaaS, published price, no human required.
- **Estate360 Managed** — done-for-you: we import your inventory, connect
  WhatsApp, migrate your leads, train your team, and own the pipeline for a
  month. Priced for the *labour*, not the software.

That framing also fixes the plan's unstated problem: an Ahmedabad broker
**cannot self-serve.** They will not log into a CRM, import 300 units from
Excel, and wire a webhook. The onboarding labour is not a margin cost you
tolerate — it is the thing they are actually buying.

### 2.5 Missing: is the product even deployed?

Nothing in the research establishes that this is running and reachable.
`BASE_URL` in `content/marketing.ts` defaults to `estate360.vercel.com`;
`.env` points at a live Supabase Postgres; there are four real workspaces in
that database. Whether a prospect can load the demo link is unknown and is
the first thing to verify. Selling a demo you cannot open is the most
expensive way to lose a first customer.

### 2.6 Missing: the compliance exposure in the prospecting itself

The plan proposes scraping 100 businesses from Maps and sending highly
personalised WhatsApp outreach. Under DPDP Act 2023 and WhatsApp Business
Messaging Policy, unsolicited bulk messaging to a scraped list is a policy
violation — and unlike the "cold email is fine" folk wisdom, WhatsApp
enforcement is real and account-level. The same document that worries about
WhatsApp pricing changes elsewhere does not notice that its own outreach plan
is the riskier use of the channel.

Send 20–30 individually researched messages, from a human, with an opt-out.
Do not build a blasting tool.

### 2.7 Missing: services have a ceiling, and the ceiling is you

A founder-led onboarding motion is fine for one customer and fatal for ten.
The plan never asks who does the migration work. If the answer is "me, at
2am, by hand", then the honest model is: pilot two, productise the onboarding
into a script, and cap it.

### 2.8 The case-study plan assumes data the client may not have

"Before: 42 enquiries, manual follow-up, no visibility" requires the client
to have counted. Most will not, and the ones who claim a number will inflate
it. Capture the baseline in week one of the pilot — before you change
anything — as a deliverable you sell, not as reporting you gather afterwards.

---

## 3. What I would actually do

**Position:** the sales operating system for Indian builders and brokerages.
Not an AI agent shop. Not a WhatsApp bot. The differentiator is that it knows
what a real-estate sale is — the unit, the cost sheet, the CLP milestone, the
RERA document, the site visit, the broker's commission — and the lead is just
the first step of that.

**Niche:** Ahmedabad residential builders and brokerages, 5–50 people,
currently on spreadsheets + WhatsApp. Not chains, not enterprise.

**Motion:** pilot-led, one customer at a time, sold with a live demo of their
own inventory rather than our seed data.

**Money:**

| | Setup (Managed) | Monthly |
| --- | --- | --- |
| Pilot | ₹25,000 | ₹5,000 |
| Standard | ₹60,000 | ₹12,000 |
| Self-serve (unchanged) | ₹0 | from ₹1,499 |

Pilot terms: 60 days, setup fee credited against the first year if they stay.
Baseline captured in week one. One named salesperson trained. Success
criterion agreed in writing before start.

**The 30-day goal is one signed pilot and one documented baseline.** Not 20
conversations as an end in itself — 20 conversations is the *input* to one
signature. The research plan quietly optimises for conversations; optimise
for signatures.

**Sequencing, in this order:**

1. Confirm the app is deployed and a stranger can reach the demo.
2. Fix the ingress hardening. *(Done — 2026-10-03; see
   `docs/architecture/production-readiness.md`.)* An open lead endpoint means
   the first customer can be banned off WhatsApp by a stranger.
3. Build the onboarding runbook — that is the real product you are selling.
4. Add the settings surface for the lead-ingest secret (currently no UI; this
   blocks self-serve onboarding entirely).
5. 20–30 researched conversations → 1 pilot.
6. Week one of the pilot: capture the baseline.
7. Turn it into a case study with a real before/after.

## 4. What I did not do, and why

- I did not choose between real estate / dental / coaching. The repo is
  real-estate-shaped; that decides it. Revisit only if 20 conversations say
  the product misses something structural.
- I did not build a settings UI for the ingest secret. Another session is
  actively editing this working tree (see §Concurrency), and the settings
  component is inside its blast radius.
- I did not deploy anything.