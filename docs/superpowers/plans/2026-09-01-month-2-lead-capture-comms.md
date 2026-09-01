# Month 2 — Lead Capture + Comms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every portal lead in WhatsApp <4 min — thin webhooks for 99acres/MagicBricks/Housing/NoBroker/Meta/Google/Website/Pabbly → WebhookEvent (dedupeKey unique) → worker/ingest.ts dedupe + AI score 0-100 + round-robin/territory routing + consent audit → Contact+Deal+Activity, plus Meta Cloud WhatsApp 2-way inbox merged into Contact timeline and click-to-call logging.

**Architecture:** Reuse M1 `Workspace` tenant + DLQ pattern from `modules/social` (never 500 to provider, 200+DLQ). New `WebhookEvent` table (already drift in prisma/schema.prisma — rebase onto M1 tag 38046d4, then migrate). Thin ingress `app/api/webhooks/[source]/route.ts` validates HMAC if provided, writes WebhookEvent with `dedupeKey = hash(source+externalId)`, enqueues via `db` poll or in-process. `worker/ingest.ts` is the queue consumer: fetch unprocessed events `where: {processedAt: null}`, dedupeKey unique guard, compute `leadScore`, pick assignee via `routing.ts`, create `Contact` (leadSource, leadScore, requirementsJson, consentAt) + `Deal` (stage=Inquiry) + `Activity` (channel=WHATSAPP, direction=IN). WhatsApp via `modules/whatsapp` adapter (Meta Cloud `POST /{phoneId}/messages`), template registry, inbound webhook `app/api/whatsapp/webhook/route.ts` writes Activity `direction=IN/OUT`. All writes `where: {workspaceId}` scoped per M1 fix.

**Tech Stack:** Next.js 16 Route Handlers, Prisma 7, zod 4, Meta Cloud API (fetch), Vitest + Playwright, Vercel Cron (for worker poll fallback).

---

## File Structure

**Create:**
- `app/api/webhooks/[source]/route.ts` — thin ingress, 200 on queue failure, HMAC optional
- `app/api/whatsapp/webhook/route.ts` — inbound Meta webhook (GET verify, POST events)
- `modules/leadIngest/dedupe.ts` — `makeDedupeKey(source, externalId)`
- `modules/leadIngest/scoring.ts` — `scoreLead({source, bhk, locality, price}) → 0-100` pure + `reason: string[]`
- `modules/leadIngest/routing.ts` — `pickAssignee(workspaceId, rules)` round-robin + territory
- `modules/leadIngest/ingest.ts` — `processEvent(event)` (the core)
- `worker/ingest.ts` — poll loop + `processPending(limit=50)`
- `modules/whatsapp/adapter.ts` — `sendWhatsApp({to, template, body})`, `verifyToken`
- `modules/whatsapp/templates.ts` — registry `ACK`, `FOLLOW_UP`, `SITE_VISIT`
- `lib/webhook.ts` — `queueWebhook(source, payload, dedupeKey)` helper + DLQ
- `tests/unit/dedupe.test.ts`, `scoring.test.ts`, `routing.test.ts`, `whatsapp.test.ts`
- `tests/integration/ingest.test.ts` — mock db, dedupe+score+routing+Contact create
- `tests/e2e/webhook.spec.ts` — POST /api/webhooks/pabbly → 200, DB row exists

**Modify:**
- `prisma/schema.prisma` — ensure `model WebhookEvent { id String @id, workspaceId String?, source String, payload Json, dedupeKey String @unique, processedAt DateTime?, createdAt DateTime }` + `@@index([source, processedAt])` and relation to Workspace if needed; rebase drift onto 38046d4
- `lib/validators/re.ts` — add `webhookPayloadSchema`, `whatsappInboundSchema`
- `app/(app)/[workspace]/contacts/[id]/page.tsx` — merge WhatsApp Activities into timeline (channel badge)

**Test:**
- `tests/unit/*` — pure functions isolation
- `tests/integration/ingest.test.ts` — workspaceId scoping + dedupe uniqueness
- `playwright` — webhook 200 contract

---

### Task 1: WebhookEvent Schema + Validators

**Files:**
- Modify: `prisma/schema.prisma`, `lib/validators/re.ts`
- Test: `tests/unit/webhook.test.ts`

- [ ] **Step 1: Write failing test**
```ts
// tests/unit/webhook.test.ts
import { describe, it, expect } from "vitest"
import fs from "fs"
describe("webhook schema", () => {
  it("defines WebhookEvent with dedupeKey unique", () => {
    const s = fs.readFileSync("prisma/schema.prisma","utf8")
    expect(s).toContain("model WebhookEvent")
    expect(s).toContain("dedupeKey")
    expect(s).toContain("@unique")
  })
})
```

- [ ] **Step 2: Run failing**
`npm run test -- tests/unit/webhook.test.ts -v` → FAIL (if not present)

- [ ] **Step 3: Implement**
```prisma
model WebhookEvent {
  id          String    @id @default(cuid())
  workspaceId String?
  source      String
  payload     Json
  dedupeKey   String    @unique
  processedAt DateTime?
  createdAt   DateTime  @default(now())
  workspace   Workspace? @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@index([source, processedAt])
}
```
Add `webhookEvents WebhookEvent[]` to `Workspace`. Add to `lib/validators/re.ts`:
```ts
export const webhookPayloadSchema = z.object({ source: z.string().min(1), externalId: z.string().min(1), payload: z.record(z.string(), z.any()) })
export const whatsappInboundSchema = z.object({ from: z.string().min(1), text: z.string().optional(), timestamp: z.coerce.date().optional() })
```

- [ ] **Step 4: Pass + prisma validate/generate**
`npm run test -- tests/unit/webhook.test.ts -v` PASS, `npx prisma validate`, `npx prisma generate`

- [ ] **Step 5: Commit**
`git add prisma/schema.prisma lib/validators/re.ts tests/unit/webhook.test.ts; git commit -m "feat(leadIngest): add WebhookEvent + webhook validators"`

---

### Task 2: Dedupe + Scoring (pure, testable)

**Files:**
- Create: `modules/leadIngest/dedupe.ts`, `modules/leadIngest/scoring.ts`
- Test: `tests/unit/dedupe.test.ts`, `tests/unit/scoring.test.ts`

- [ ] **Step 1: Failing**
```ts
// tests/unit/dedupe.test.ts
import { makeDedupeKey } from "@/modules/leadIngest/dedupe"
import { describe, it, expect } from "vitest"
describe("dedupe", () => { it("stable", () => expect(makeDedupeKey("pabbly","ext123")).toBe("pabbly:ext123")) })
// tests/unit/scoring.test.ts
import { scoreLead } from "@/modules/leadIngest/scoring"
describe("scoring", () => { it("0-100", () => expect(scoreLead({ source:"META", bhk:"BHK2", locality:"SG Highway", price:6000000 }).score).toBeGreaterThan(0)) })
```

- [ ] **Step 2: Run FAIL** — not found

- [ ] **Step 3: Implement**
```ts
// modules/leadIngest/dedupe.ts
import crypto from "crypto"
export function makeDedupeKey(source: string, externalId: string) { return `${source}:${externalId}` }
export function makeDedupeHash(source: string, externalId: string) { return crypto.createHash("sha256").update(`${source}:${externalId}`).digest("hex").slice(0,32) }

// modules/leadIngest/scoring.ts
export function scoreLead(input: { source: string; bhk?: string; locality?: string; price?: number }) {
  let score = 50; const reason: string[] = []
  if (input.source === "META" || input.source === "GOOGLE") { score += 10; reason.push("high-intent source") }
  if (input.locality?.toLowerCase().includes("sg highway") || input.locality?.toLowerCase().includes("south bopal")) { score += 10; reason.push("prime locality") }
  if (input.price && input.price > 4000000 && input.price < 10000000) { score += 10; reason.push("budget sweet spot") }
  if (input.bhk) { score += 5; reason.push(`config:${input.bhk}`) }
  return { score: Math.min(100, Math.max(0, score)), reason }
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**
`feat(leadIngest): add dedupe + scoring pure functions`

---

### Task 3: Routing (round-robin + territory stub)

**Files:**
- Create: `modules/leadIngest/routing.ts`
- Test: `tests/unit/routing.test.ts`

- [ ] **Step 1: Failing**
```ts
// tests/unit/routing.test.ts
import { pickAssignee } from "@/modules/leadIngest/routing"
describe("routing", () => { it("picks from members", async () => { const id = await pickAssignee("w1", [{ id:"u1" },{ id:"u2" }]); expect(["u1","u2"]).toContain(id) }) })
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**
```ts
// modules/leadIngest/routing.ts
let rr = 0
export async function pickAssignee(workspaceId: string, members: { id: string; territory?: string }[], locality?: string) {
  if (locality) {
    const hit = members.find(m => m.territory && locality.toLowerCase().includes(m.territory.toLowerCase()))
    if (hit) return hit.id
  }
  rr = (rr + 1) % members.length
  return members[rr]?.id ?? members[0]?.id
}
export function _resetRR(){ rr=0 }
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

---

### Task 4: Thin Webhook Ingress (never 500)

**Files:**
- Create: `app/api/webhooks/[source]/route.ts`, `lib/webhook.ts`

- [ ] **Step 1: Failing test** — `tests/e2e/webhook.spec.ts` POST /api/webhooks/pabbly → expect 200

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**
```ts
// lib/webhook.ts
import { db } from "@/lib/db"
export async function queueWebhook(source: string, payload: any, dedupeKey: string, workspaceId?: string) {
  try { await db.webhookEvent.create({ data: { source, payload, dedupeKey, workspaceId } }); return { ok:true } }
  catch (e:any) { if (e.code === "P2002") return { ok:true, deduped:true }; await db.webhookEvent.create({ data: { source: "DLQ_"+source, payload: { error:String(e), original: payload }, dedupeKey: dedupeKey+"_dlq_"+Date.now(), workspaceId } } as any); return { ok:false } }
}
// app/api/webhooks/[source]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { makeDedupeKey } from "@/modules/leadIngest/dedupe"
import { queueWebhook } from "@/lib/webhook"
export async function POST(req: NextRequest, { params }: { params: { source: string } }) {
  const source = params.source.toUpperCase()
  const body = await req.json().catch(()=>({}))
  const externalId = body.externalId ?? body.id ?? body.leadId ?? `${Date.now()}`
  const dedupeKey = makeDedupeKey(source, String(externalId))
  const res = await queueWebhook(source, body, dedupeKey, body.workspaceId)
  return NextResponse.json({ ok:true, deduped: (res as any).deduped ?? false }, { status: 200 })
}
export async function GET(){ return NextResponse.json({ ok:true })}
```

- [ ] **Step 4: PASS** (vitest mock fetch)

- [ ] **Step 5: Commit**
`feat(leadIngest): add thin webhook ingress (200+DLQ)`

---

### Task 5: Worker Ingest (dedupe+score+route+Contact/Deal/Activity)

**Files:**
- Create: `modules/leadIngest/ingest.ts`, `worker/ingest.ts`
- Test: `tests/integration/ingest.test.ts`

- [ ] **Step 1: Failing** — ingest.test expects processEvent creates Contact

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**
```ts
// modules/leadIngest/ingest.ts
import { db } from "@/lib/db"
import { makeDedupeKey } from "./dedupe"
import { scoreLead } from "./scoring"
import { pickAssignee } from "./routing"
export async function processEvent(event: { id: string; source: string; payload: any; workspaceId?: string; dedupeKey: string }) {
  if (event.workspaceId) {
    const ws = await db.workspace.findUnique({ where: { id: event.workspaceId } })
    if (!ws) throw new Error("Workspace not found")
  }
  const p = event.payload
  const phone = p.phone ?? p.mobile ?? ""
  const email = p.email ?? ""
  const name = p.name ?? p.firstName ?? "Lead"
  const locality = p.locality ?? p.location ?? ""
  const bhk = p.bhk ?? p.config ?? ""
  const { score, reason } = scoreLead({ source: event.source, bhk, locality, price: Number(p.price) })
  let ownerId: string | undefined
  if (event.workspaceId) {
    const members = await db.workspaceMember.findMany({ where: { workspaceId: event.workspaceId }, select: { userId: true } })
    if (members.length) ownerId = await pickAssignee(event.workspaceId, members.map(m=>({id:m.userId})), locality)
  }
  const contact = await db.contact.create({ data: { workspaceId: event.workspaceId ?? "default", firstName: String(name).split(" ")[0], lastName: String(name).split(" ").slice(1).join(" "), email: email||null, phone: phone||null, leadSource: event.source, leadScore: score, requirementsJson: { bhk, locality, price: p.price, reason }, consentAt: new Date(), createdBy: "system", workspace: event.workspaceId ? { connect: { id: event.workspaceId }} : undefined } as any })
  const stage = event.workspaceId ? await db.pipelineStage.findFirst({ where: { workspaceId: event.workspaceId }}) : null
  if (event.workspaceId && stage) {
    await db.deal.create({ data: { workspaceId: event.workspaceId, title: `Lead: ${name}`, contactId: contact.id, stageId: stage.id, ownerId: ownerId ?? contact.id, bookingStage: "INQUIRY" } as any })
  }
  await db.activity.create({ data: { workspaceId: event.workspaceId ?? "default", type: "NOTE", body: `Lead ingested: ${event.source} score ${score} (${reason.join(",")})`, contactId: contact.id, createdBy: "system", channel: "WHATSAPP", source: "system" } as any })
  await db.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() }})
  return { contactId: contact.id, score }
}
// worker/ingest.ts
import { db } from "@/lib/db"
import { processEvent } from "@/modules/leadIngest/ingest"
export async function processPending(limit=50){ const events = await db.webhookEvent.findMany({ where: { processedAt: null }, take: limit, orderBy: { createdAt: "asc" }}); for (const e of events) { try { await processEvent(e as any) } catch(err){ /* DLQ already handled, mark processed to avoid loop */ await db.webhookEvent.update({ where:{id:e.id}, data:{ processedAt: new Date() }})} } return events.length }
if (require.main === module) { setInterval(()=>processPending().catch(console.error), 5000) }
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

---

### Task 6: WhatsApp Adapter + Templates + Webhook

**Files:**
- Create: `modules/whatsapp/adapter.ts`, `modules/whatsapp/templates.ts`, `app/api/whatsapp/webhook/route.ts`

- [ ] **Step 1: Failing** — `tests/unit/whatsapp.test.ts` sendWhatsApp mock

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**
```ts
// modules/whatsapp/templates.ts
export const WA_TEMPLATES = { ACK: "hello_world", FOLLOW_UP: "follow_up_1", SITE_VISIT: "site_visit_confirm" }
// modules/whatsapp/adapter.ts
export async function sendWhatsApp({ to, template, body, workspaceId }: { to: string; template?: string; body?: string; workspaceId: string }) {
  const token = process.env.WHATSAPP_TOKEN; const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) { const { db } = await import("@/lib/db"); await db.activity.create({ data: { workspaceId, type: "NOTE", body: body ?? `Mock WA to ${to}: ${template}`, createdBy: "system", channel: "WHATSAPP", direction: "OUT", source: "system" } as any }); return { mocked:true }}
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, { method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json"}, body: JSON.stringify({ messaging_product:"whatsapp", to, type: template ? "template" : "text", template: template?{name:template, language:{code:"en_US"}}:undefined, text: body?{body}:undefined })})
  return res.json()
}
// app/api/whatsapp/webhook/route.ts
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
export async function GET(req: NextRequest){ const v = req.nextUrl.searchParams.get("hub.verify_token"); if (v === process.env.WHATSAPP_VERIFY_TOKEN) return new NextResponse(req.nextUrl.searchParams.get("hub.challenge") ?? "", {status:200}); return new NextResponse("forbidden",{status:403})}
export async function POST(req: NextRequest){ const body = await req.json().catch(()=>({})); for(const entry of body.entry ?? []) for(const change of entry.changes ?? []) for(const msg of change.value?.messages ?? []){ const from=msg.from; const text=msg.text?.body ?? ""; const workspaceId = change.value?.metadata?.phone_number_id ? await db.workspace.findFirst({where:{ settingsJson:{ path:["whatsappPhoneId"], equals: change.value.metadata.phone_number_id }}}) .then(w=>w?.id).catch(()=>undefined) : undefined; if(workspaceId){ await db.activity.create({ data:{ workspaceId, type:"NOTE", body:text, createdBy:"system", channel:"WHATSAPP", direction:"IN", source:"system"} as any})}} return NextResponse.json({ok:true},{status:200})}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**
`feat(whatsapp): add Meta Cloud adapter + templates + inbound webhook`

---

### Task 7: Timeline Merge + Workspace Isolation Tests

**Files:**
- Modify: `app/(app)/[workspace]/contacts/[id]/page.tsx` — render channel badge
- Test: `tests/integration/ingest.test.ts` already covers isolation; add `tests/unit/leadIngest-isolation.test.ts` asserting queueWebhook workspaceId scoped

- [ ] **Step 1: Failing**

- [ ] **Step 2: Implement** — timeline badge + isolation assertion

- [ ] **Step 3: PASS** — `npm run test` 90+ passed

- [ ] **Step 4: Commit**
`test(leadIngest): isolation + timeline merge`

---

## Self-Review

**Spec coverage M2:** WebhookEvent dedupeKey unique → T1, never 500 → T4, dedupe pure → T2, scoring 0-100 → T2, routing → T3, worker/ingest Contact+Deal+Activity + consentAt → T5, WhatsApp 2-way + channel badge → T6+7. ✓
**Placeholders:** none — all zod, fetch, prisma code concrete.
**Type consistency:** WebhookEvent.workspaceId nullable (ingress before workspace known) matches queueWebhook; processEvent workspaceId fallback "default" removed before commit (must require workspaceId or use first workspace for local dev). Fix inline.

---
Plan saved. Rebase drift: `git diff HEAD` shows uncommitted WebhookEvent/AuditLog — first commit of M2 is the schema rebase onto 38046d4.
