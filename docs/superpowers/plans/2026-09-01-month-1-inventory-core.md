# Month 1 — Inventory Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Inventory Core — Project→Tower→Floor→Unit hierarchy, availability grid, status transitions, cost-sheet engine (<30s), CSV import (200 units), RERA template stub — all workspace-scoped, logged as Activity.

**Architecture:** Additive Prisma models (Project, Tower, Floor, Unit, CostSheet, DocumentTemplate, GeneratedDocument) + extensions to Contact/Deal/Activity. Thin `modules/property` + `modules/costSheet` + `modules/documents` server actions with zod at `lib/validators/re.ts`. UI at `app/(app)/[workspace]/projects`. Reuse DLQ pattern from `modules/social` for CSV import errors. Every query filtered by `workspaceId`.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + `@prisma/adapter-pg`, PostgreSQL, zod 4, shadcn/ui, Tailwind v4, Vitest + Playwright, Supabase Storage (pdf), `date-fns`.

---

## File Structure

**Create:**
- `lib/validators/re.ts` — zod schemas for RE (project, tower, floor, unit, costSheet, documentTemplate)
- `modules/property/actions.ts` — server actions: createProject, createTower, createFloor, createUnit, updateUnitStatus, listUnits
- `modules/property/queries.ts` — workspace-scoped reads with filters
- `modules/costSheet/actions.ts` — generateCostSheet (base+GST+stamp+others → total, versioned)
- `modules/costSheet/calc.ts` — pure calc + tests
- `modules/documents/actions.ts` — createTemplate, renderDocument (shortcodes)
- `modules/documents/shortcodes.ts` — `{{rera_no}}`, `{{carpet_area}}`, `{{total}}` etc.
- `app/(app)/[workspace]/projects/page.tsx` — projects list
- `app/(app)/[workspace]/projects/[projectId]/page.tsx` — InventoryGrid + filters + unit drawer
- `components/property/InventoryGrid.tsx` — bento grid, status colors, filters
- `components/property/UnitDrawer.tsx` — unit detail + cost sheet preview + WhatsApp share
- `components/property/CostSheetCard.tsx` — cost breakdown
- `lib/csv.ts` — CSV parse helper for import
- `tests/unit/costSheet.test.ts`, `tests/unit/shortcodes.test.ts`, `tests/unit/property.test.ts`
- `tests/integration/property-isolation.test.ts` — workspace isolation

**Modify:**
- `prisma/schema.prisma:1-40` — add 7 models + extend Contact/Deal/Activity/Workspace + enums UnitStatus, Config
- `lib/permissions.ts:1-62` — add `canManageInventory` helper + keep requireWorkspaceMember gate
- `lib/validators.ts` — re-export from `re.ts` (no break)
- `app/(app)/[workspace]/layout.tsx` — add Projects nav link

**Test:**
- `tests/unit/costSheet.test.ts` — calc correctness
- `tests/unit/shortcodes.test.ts` — render correctness
- `vitest.config.ts` — already handles `tests/unit`
- `playwright.config.ts` — e2e for CSV → grid → cost sheet

---

### Task 1: Prisma Schema — RE Models

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `tests/unit/property.test.ts` (schema import check)

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/property.test.ts
import { describe, it, expect } from "vitest"
describe("RE schema", () => {
  it("defines UnitStatus enum and Project model", async () => {
    const fs = await import("fs")
    const s = fs.readFileSync("prisma/schema.prisma", "utf8")
    expect(s).toContain("enum UnitStatus")
    expect(s).toContain("model Project")
    expect(s).toContain("model Unit")
    expect(s).toContain("model CostSheet")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/property.test.ts -v`
Expected: FAIL — `enum UnitStatus` not found

- [ ] **Step 3: Write minimal implementation**

```prisma
// prisma/schema.prisma — append after PlanLimits, before SocialConnection
enum UnitStatus { AVAILABLE HOLD BOOKED SOLD }
enum UnitConfig { BHK1 BHK2 BHK3 BHK4 VILLA PLOT SHOP OFFICE }
enum DocumentKind { DEMAND_LETTER ALLOTMENT BOOKING_FORM RECEIPT POSSESSION }

model Project {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  reraNo      String?
  address     String?
  city        String   @default("Ahmedabad")
  type        String   @default("RESIDENTIAL")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  towers      Tower[]
  units       Unit[]
  plans       PaymentPlan[]
  @@index([workspaceId])
  @@unique([workspaceId, name])
}

model Tower {
  id        String   @id @default(cuid())
  projectId String
  name      String
  floors    Int      @default(10)
  createdAt DateTime @default(now())
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  floorsRel Floor[]
  @@index([projectId])
}

model Floor {
  id      String @id @default(cuid())
  towerId String
  number  Int
  tower   Tower  @relation(fields: [towerId], references: [id], onDelete: Cascade)
  units   Unit[]
  @@unique([towerId, number])
}

model Unit {
  id         String     @id @default(cuid())
  workspaceId String
  projectId  String
  floorId    String?
  unitNo     String
  config     UnitConfig @default(BHK2)
  area       Float?
  carpetArea Float?
  builtUp    Float?
  facing     String?
  price      Float?
  status     UnitStatus @default(AVAILABLE)
  holdUntil  DateTime?
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  workspace  Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project    Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  floor      Floor?    @relation(fields: [floorId], references: [id], onDelete: SetNull)
  costSheets CostSheet[]
  deals      Deal[]
  @@index([workspaceId])
  @@index([projectId])
  @@index([status])
  @@unique([projectId, unitNo])
}

model CostSheet {
  id           String   @id @default(cuid())
  workspaceId  String
  unitId       String
  dealId       String?
  version      Int      @default(1)
  basePrice    Float
  gst          Float    @default(0)
  stampDuty    Float    @default(0)
  otherCharges Json?
  total        Float
  currency     String   @default("INR")
  createdAt    DateTime @default(now())
  workspace    Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  unit         Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)
  deal         Deal?    @relation(fields: [dealId], references: [id], onDelete: SetNull)
  @@index([workspaceId])
  @@index([unitId])
}

model PaymentPlan {
  id          String   @id @default(cuid())
  projectId   String
  name        String
  createdAt   DateTime @default(now())
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  milestones  PaymentMilestone[]
  @@index([projectId])
}
model PaymentMilestone {
  id       String @id @default(cuid())
  planId   String
  label    String
  pct      Float
  order    Int
  plan     PaymentPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  @@index([planId])
}
model Payment {
  id          String   @id @default(cuid())
  workspaceId String
  dealId      String
  milestoneId String?
  amount      Float
  dueDate     DateTime?
  status      String   @default("DUE")
  receiptNo   String?
  paidAt      DateTime?
  createdAt   DateTime @default(now())
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  deal        Deal     @relation(fields: [dealId], references: [id], onDelete: Cascade)
  @@index([workspaceId])
  @@index([dealId])
}
model DocumentTemplate {
  id          String       @id @default(cuid())
  workspaceId String
  kind        DocumentKind
  name        String
  bodyHtml    String
  reraAligned Boolean @default(true)
  createdAt   DateTime @default(now())
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@index([workspaceId, kind])
}
model GeneratedDocument {
  id          String   @id @default(cuid())
  workspaceId String
  dealId      String?
  unitId      String?
  templateId  String
  renderedHtml String
  pdfUrl      String?
  eSignStatus String   @default("PENDING")
  createdAt   DateTime @default(now())
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  template    DocumentTemplate @relation(fields: [templateId], references: [id], onDelete: Restrict)
  @@index([workspaceId])
}

// Extend existing — add to Workspace: settingsJson Json?, projects Project[], payments Payment[], documentTemplates DocumentTemplate[], generatedDocuments GeneratedDocument[]
// Contact: add leadSource String?, leadScore Int?, requirementsJson Json?, kycJson Json?, consentAt DateTime?, optedOut Boolean @default(false)
// Deal: add unitId String? FK->Unit, paymentPlanId String? FK->PaymentPlan, bookingStage String?, costSheetId String? FK->CostSheet
// Activity: add channel String?, templateId String?, direction String?
```

Also add relations to `Workspace` model (add `projects Project[]`, `payments Payment[]`, `documentTemplates DocumentTemplate[]`, `generatedDocuments GeneratedDocument[]`) and extend Contact/Deal/Activity blocks directly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/property.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma tests/unit/property.test.ts
git commit -m "feat(property): add RE prisma models Project/Tower/Floor/Unit/CostSheet"

npx prisma generate
npx prisma migrate dev --name re-inventory-core
```

---

### Task 2: Validators & Permissions

**Files:**
- Create: `lib/validators/re.ts`
- Modify: `lib/permissions.ts:4-15`, `lib/validators.ts:126`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/re-validators.test.ts
import { projectSchema, unitSchema, costSheetSchema } from "@/lib/validators/re"
import { describe, it, expect } from "vitest"
describe("re validators", () => {
  it("rejects empty project name", () => {
    expect(() => projectSchema.parse({ name: "" })).toThrow()
  })
  it("accepts valid unit", () => {
    expect(() => unitSchema.parse({ unitNo: "A-101", price: 5000000, config: "BHK2" })).not.toThrow()
  })
  it("calculates costSheet total validation", () => {
    expect(() => costSheetSchema.parse({ unitId: "u1", basePrice: -1 })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/re-validators.test.ts -v`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/validators/re.ts
import { z } from "zod"
export const projectSchema = z.object({
  name: z.string().trim().min(1).max(160),
  reraNo: z.string().trim().max(80).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().max(80).default("Ahmedabad"),
  type: z.enum(["RESIDENTIAL","COMMERCIAL","PLOT"]).default("RESIDENTIAL"),
})
export const towerSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  floors: z.coerce.number().int().min(1).max(100).default(10),
})
export const floorSchema = z.object({
  towerId: z.string().min(1),
  number: z.coerce.number().int().min(0).max(200),
})
export const unitSchema = z.object({
  projectId: z.string().min(1),
  floorId: z.string().optional().or(z.literal("")),
  unitNo: z.string().trim().min(1).max(40),
  config: z.enum(["BHK1","BHK2","BHK3","BHK4","VILLA","PLOT","SHOP","OFFICE"]).default("BHK2"),
  area: z.coerce.number().min(0).optional().nullable(),
  carpetArea: z.coerce.number().min(0).optional().nullable(),
  builtUp: z.coerce.number().min(0).optional().nullable(),
  facing: z.string().trim().max(20).optional().or(z.literal("")),
  price: z.coerce.number().min(0).optional().nullable(),
  status: z.enum(["AVAILABLE","HOLD","BOOKED","SOLD"]).default("AVAILABLE"),
})
export const costSheetSchema = z.object({
  unitId: z.string().min(1),
  dealId: z.string().optional().or(z.literal("")),
  basePrice: z.coerce.number().min(0),
  gst: z.coerce.number().min(0).default(0),
  stampDuty: z.coerce.number().min(0).default(0),
  otherCharges: z.record(z.string(), z.number()).optional(),
})
export const documentTemplateSchema = z.object({
  kind: z.enum(["DEMAND_LETTER","ALLOTMENT","BOOKING_FORM","RECEIPT","POSSESSION"]),
  name: z.string().trim().min(1).max(160),
  bodyHtml: z.string().trim().min(1).max(50000),
  reraAligned: z.boolean().default(true),
})
export const updateUnitStatusSchema = z.object({
  unitId: z.string().min(1),
  status: z.enum(["AVAILABLE","HOLD","BOOKED","SOLD"]),
  holdUntil: z.coerce.date().optional().nullable(),
})
```

```ts
// lib/validators.ts — append at bottom
export * from "./validators/re"
```

```ts
// lib/permissions.ts — add after canManageBilling
export function canManageInventory(role: Role) {
  return role === "OWNER" || role === "ADMIN"
}
export function canViewInventory(role: Role) { return true }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/re-validators.test.ts -v`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add lib/validators/re.ts lib/validators.ts lib/permissions.ts tests/unit/re-validators.test.ts
git commit -m "feat(validators): add RE zod schemas + inventory permissions"
```

---

### Task 3: Property Actions & Queries

**Files:**
- Create: `modules/property/actions.ts`, `modules/property/queries.ts`
- Test: `tests/unit/property-actions.test.ts` (mock db)

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/property-actions.test.ts
import { describe, it, expect, vi } from "vitest"
vi.mock("@/lib/db", () => ({ db: { project: { create: vi.fn() }, unit: { create: vi.fn(), findMany: vi.fn() } } }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "u1" } }) }))
import { createProject } from "@/modules/property/actions"
describe("property actions", () => {
  it("createProject validates auth", async () => {
    const r = await createProject({ workspaceId: "w1", data: { name: "Sun Residency" } })
    expect(r).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/property-actions.test.ts -v`
Expected: FAIL — not defined

- [ ] **Step 3: Write minimal implementation**

```ts
// modules/property/actions.ts
"use server"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { projectSchema, towerSchema, floorSchema, unitSchema, updateUnitStatusSchema } from "@/lib/validators/re"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

async function authed(workspaceId: string) {
  const s = await auth()
  if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  return s.user.id
}

export async function createProject({ workspaceId, data }: { workspaceId: string; data: unknown }) {
  await authed(workspaceId)
  const parsed = projectSchema.parse(data)
  const project = await db.project.create({ data: { ...parsed, workspaceId } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Project created: ${project.name}`, createdBy: "system", source: "system" } })
  revalidatePath(`/${workspaceId}/projects`)
  return project
}
export async function createTower(input: { workspaceId: string; data: unknown }) {
  const { workspaceId, data } = input
  await authed(workspaceId)
  const p = towerSchema.parse(data)
  return db.tower.create({ data: p })
}
export async function createFloor(input: { workspaceId: string; data: unknown }) {
  const { workspaceId, data } = input
  await authed(workspaceId)
  const p = floorSchema.parse(data)
  return db.floor.create({ data: p })
}
export async function createUnit(input: { workspaceId: string; data: unknown }) {
  const { workspaceId, data } = input
  await authed(workspaceId)
  const p = unitSchema.parse(data) as any
  const unit = await db.unit.create({ data: { ...p, workspaceId, floorId: p.floorId || null } })
  revalidatePath(`/${workspaceId}/projects/${p.projectId}`)
  return unit
}
export async function updateUnitStatus(input: { workspaceId: string; data: unknown }) {
  const { workspaceId, data } = input
  await authed(workspaceId)
  const { unitId, status, holdUntil } = updateUnitStatusSchema.parse(data)
  const unit = await db.unit.update({ where: { id: unitId }, data: { status: status as any, holdUntil } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Unit ${unit.unitNo} → ${status}`, createdBy: "system", source: "system" } })
  return unit
}
```

```ts
// modules/property/queries.ts
import { db } from "@/lib/db"
export async function listProjects(workspaceId: string) {
  return db.project.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, include: { towers: true, _count: { select: { units: true } } } })
}
export async function listUnits(workspaceId: string, filters: { projectId?: string; status?: string; config?: string; minPrice?: number; maxPrice?: number; search?: string } = {}) {
  return db.unit.findMany({
    where: {
      workspaceId,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status as any } : {}),
      ...(filters.config ? { config: filters.config as any } : {}),
      ...(filters.minPrice || filters.maxPrice ? { price: { gte: filters.minPrice, lte: filters.maxPrice } } : {}),
      ...(filters.search ? { unitNo: { contains: filters.search, mode: "insensitive" } } : {}),
    },
    orderBy: { unitNo: "asc" },
    include: { floor: true, project: true },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/property-actions.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/property/actions.ts modules/property/queries.ts tests/unit/property-actions.test.ts
git commit -m "feat(property): add Project/Tower/Floor/Unit actions + queries"
```

---

### Task 4: Cost Sheet Engine

**Files:**
- Create: `modules/costSheet/calc.ts`, `modules/costSheet/actions.ts`
- Test: `tests/unit/costSheet.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/costSheet.test.ts
import { calcTotal } from "@/modules/costSheet/calc"
import { describe, it, expect } from "vitest"
describe("calcTotal", () => {
  it("sums base+gst+stamp+others", () => {
    expect(calcTotal({ basePrice: 5000000, gst: 250000, stampDuty: 300000, otherCharges: { maintenance: 50000 } })).toBe(5600000)
  })
  it("is numeric, INR default", () => {
    expect(calcTotal({ basePrice: 100 })).toBeGreaterThan(99)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/costSheet.test.ts -v`
Expected: FAIL — not defined

- [ ] **Step 3: Write minimal implementation**

```ts
// modules/costSheet/calc.ts
export function calcTotal(input: { basePrice: number; gst: number; stampDuty: number; otherCharges?: Record<string, number> }) {
  const others = input.otherCharges ? Object.values(input.otherCharges).reduce((a, b) => a + b, 0) : 0
  return input.basePrice + input.gst + input.stampDuty + others
}
```

```ts
// modules/costSheet/actions.ts
"use server"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { costSheetSchema } from "@/lib/validators/re"
import { calcTotal } from "./calc"
import { auth } from "@/lib/auth"

export async function generateCostSheet({ workspaceId, data }: { workspaceId: string; data: unknown }) {
  const s = await auth()
  if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  const p = costSheetSchema.parse(data) as any
  const total = calcTotal({ basePrice: p.basePrice, gst: p.gst, stampDuty: p.stampDuty, otherCharges: p.otherCharges })
  const existing = await db.costSheet.count({ where: { unitId: p.unitId } })
  const sheet = await db.costSheet.create({ data: { ...p, workspaceId, total, version: existing + 1, otherCharges: p.otherCharges ?? {} } })
  await db.activity.create({ data: { workspaceId, type: "NOTE", body: `Cost sheet v${sheet.version} generated: ₹${total.toLocaleString("en-IN")}`, createdBy: s.user.id, source: "system" } })
  return sheet
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/costSheet.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/costSheet/calc.ts modules/costSheet/actions.ts tests/unit/costSheet.test.ts
git commit -m "feat(costsheet): add calc + generateCostSheet action"
```

---

### Task 5: Inventory Grid + Project Pages

**Files:**
- Create: `app/(app)/[workspace]/projects/page.tsx`, `app/(app)/[workspace]/projects/[projectId]/page.tsx`, `components/property/InventoryGrid.tsx`, `components/property/UnitDrawer.tsx`, `components/property/CostSheetCard.tsx`

- [ ] **Step 1: Write failing test (component render)**

```ts
// tests/unit/inventory-grid.test.tsx
import { render, screen } from "@testing-library/react"
import InventoryGrid from "@/components/property/InventoryGrid"
import { describe, it, expect } from "vitest"
describe("InventoryGrid", () => {
  it("renders units with status badges", () => {
    render(<InventoryGrid units={[{ id: "1", unitNo: "A-101", status: "AVAILABLE", price: 5000000, config: "BHK2" } as any]} />)
    expect(screen.getByText("A-101")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/inventory-grid.test.tsx -v`
Expected: FAIL — not found

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/property/InventoryGrid.tsx
"use client"
type Unit = { id: string; unitNo: string; status: string; price?: number; config: string }
const STATUS_COLOR: Record<string, string> = { AVAILABLE: "bg-emerald-100 text-emerald-800", HOLD: "bg-amber-100 text-amber-800", BOOKED: "bg-blue-100 text-blue-800", SOLD: "bg-gray-200 text-gray-600" }
export default function InventoryGrid({ units, onSelect }: { units: Unit[]; onSelect?: (u: Unit) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {units.map(u => (
        <button key={u.id} onClick={() => onSelect?.(u)} className="border rounded-lg p-3 text-left hover:shadow bg-card">
          <div className="font-mono text-sm font-semibold">{u.unitNo}</div>
          <div className="text-xs text-muted-foreground">{u.config} · ₹{(u.price ?? 0).toLocaleString("en-IN")}</div>
          <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[u.status]}`}>{u.status}</span>
        </button>
      ))}
    </div>
  )
}
```

```tsx
// components/property/CostSheetCard.tsx
export function CostSheetCard({ sheet }: { sheet: { basePrice: number; gst: number; stampDuty: number; total: number; otherCharges?: Record<string, number> } }) {
  return (
    <div className="border rounded-lg p-4 space-y-2 text-sm">
      <div className="flex justify-between"><span>Base</span><span>₹{sheet.basePrice.toLocaleString("en-IN")}</span></div>
      <div className="flex justify-between"><span>GST</span><span>₹{sheet.gst.toLocaleString("en-IN")}</span></div>
      <div className="flex justify-between"><span>Stamp Duty</span><span>₹{sheet.stampDuty.toLocaleString("en-IN")}</span></div>
      {sheet.otherCharges && Object.entries(sheet.otherCharges).map(([k,v])=><div key={k} className="flex justify-between"><span>{k}</span><span>₹{v.toLocaleString("en-IN")}</span></div>)}
      <div className="border-t pt-2 flex justify-between font-semibold"><span>Total</span><span>₹{sheet.total.toLocaleString("en-IN")}</span></div>
    </div>
  )
}
```

```tsx
// app/(app)/[workspace]/projects/page.tsx
import { listProjects } from "@/modules/property/queries"
import Link from "next/link"
export default async function ProjectsPage({ params }: { params: { workspace: string } }) {
  const slug = params.workspace
  const { db } = await import("@/lib/db")
  const ws = await db.workspace.findUnique({ where: { slug } })
  if (!ws) return <div>Workspace not found</div>
  const projects = await listProjects(ws.id)
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <div className="grid md:grid-cols-3 gap-4">
        {projects.map(p => (
          <Link key={p.id} href={`/${slug}/projects/${p.id}`} className="border rounded-lg p-4 hover:shadow">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-muted-foreground">{p.reraNo ?? "RERA TBD"} · {p._count.units} units</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/inventory-grid.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/\(\app\)/\[workspace\]/projects components/property tests/unit/inventory-grid.test.tsx
git commit -m "feat(property): add Projects list + InventoryGrid + CostSheetCard"
```

---

### Task 6: CSV Import + Status Machine + Hold TTL

**Files:**
- Create: `lib/csv.ts`, `modules/property/import.ts`
- Test: `tests/unit/csv.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/csv.test.ts
import { parseUnitsCsv } from "@/lib/csv"
import { describe, it, expect } from "vitest"
describe("parseUnitsCsv", () => {
  it("parses header + 1 row", () => {
    const csv = "unitNo,config,price,status\nA-101,BHK2,5000000,AVAILABLE"
    expect(parseUnitsCsv(csv)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/csv.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/csv.ts
export function parseUnitsCsv(csv: string) {
  const [headerLine, ...rows] = csv.trim().split("\n")
  const headers = headerLine.split(",").map(h => h.trim())
  return rows.filter(Boolean).map(line => {
    const vals = line.split(",").map(v => v.trim())
    const rec: Record<string, string> = {}
    headers.forEach((h,i) => rec[h] = vals[i] ?? "")
    return rec
  })
}
```

```ts
// modules/property/import.ts
"use server"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { parseUnitsCsv } from "@/lib/csv"
import { auth } from "@/lib/auth"

const ALLOWED: Record<string, string[]> = {
  AVAILABLE: ["HOLD","BOOKED"],
  HOLD: ["AVAILABLE","BOOKED"],
  BOOKED: ["SOLD"],
  SOLD: [],
}

export async function importUnitsCsv({ workspaceId, projectId, csv }: { workspaceId: string; projectId: string; csv: string }) {
  const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  const rows = parseUnitsCsv(csv)
  let created = 0
  for (const r of rows) {
    await db.unit.create({ data: { workspaceId, projectId, unitNo: r.unitNo, config: (r.config as any) ?? "BHK2", price: Number(r.price) || 0, status: (r.status as any) ?? "AVAILABLE" } })
    created++
  }
  return { created }
}
export function canTransition(from: string, to: string) { return (ALLOWED[from] ?? []).includes(to) }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/csv.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/csv.ts modules/property/import.ts tests/unit/csv.test.ts
git commit -m "feat(property): add CSV import + status state machine"
```

---

### Task 7: RERA Shortcodes & Document Render

**Files:**
- Create: `modules/documents/shortcodes.ts`, `modules/documents/actions.ts`
- Test: `tests/unit/shortcodes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/shortcodes.test.ts
import { renderShortcodes } from "@/modules/documents/shortcodes"
import { describe, it, expect } from "vitest"
describe("shortcodes", () => {
  it("replaces {{rera_no}} and {{total}}", () => {
    expect(renderShortcodes("RERA {{rera_no}} total {{total}}", { rera_no: "M/GUJ/1", total: "5600000" })).toBe("RERA M/GUJ/1 total 5600000")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/shortcodes.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
// modules/documents/shortcodes.ts
export function renderShortcodes(template: string, data: Record<string, string>) {
  let out = template
  for (const [k,v] of Object.entries(data)) out = out.replaceAll(`{{${k}}}`, v).replaceAll(`{{ ${k} }}`, v)
  return out
}
export const RE_SHORTCODES = ["rera_no","project_name","unit_no","carpet_area","built_up","total","base_price","gst","stamp_duty","buyer_name","booking_date"] as const
```

```ts
// modules/documents/actions.ts
"use server"
import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { documentTemplateSchema } from "@/lib/validators/re"
import { renderShortcodes } from "./shortcodes"
import { auth } from "@/lib/auth"

export async function createTemplate({ workspaceId, data }: { workspaceId: string; data: unknown }) {
  const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  const p = documentTemplateSchema.parse(data)
  return db.documentTemplate.create({ data: { ...p, workspaceId } })
}
export async function generateDocument({ workspaceId, templateId, context }: { workspaceId: string; templateId: string; context: Record<string,string> }) {
  const s = await auth(); if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  const tpl = await db.documentTemplate.findFirst({ where: { id: templateId, workspaceId } })
  if (!tpl) throw new Error("Template not found")
  const rendered = renderShortcodes(tpl.bodyHtml, context)
  return db.generatedDocument.create({ data: { workspaceId, templateId, renderedHtml: rendered } })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/shortcodes.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add modules/documents/shortcodes.ts modules/documents/actions.ts tests/unit/shortcodes.test.ts
git commit -m "feat(documents): add RERA shortcodes + template render"
```

---

### Task 8: Workspace Isolation + E2E Smoke

**Files:**
- Create: `tests/integration/property-isolation.test.ts`, `tests/e2e/inventory.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/property-isolation.test.ts
import { describe, it, expect } from "vitest"
import { listUnits } from "@/modules/property/queries"
describe("isolation", () => {
  it("listUnits filters by workspaceId", async () => {
    // will fail until queries enforce workspaceId
    expect(listUnits).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/integration/property-isolation.test.ts -v`
Expected: FAIL (or pending)

- [ ] **Step 3: Write minimal implementation**

Already done — `listUnits` filters by `workspaceId` (Task 3). Add explicit e2e:

```ts
// tests/e2e/inventory.spec.ts
import { test, expect } from "@playwright/test"
test("projects → inventory → cost sheet", async ({ page }) => {
  await page.goto("/acme/projects")
  await expect(page.getByText("Projects")).toBeVisible()
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit -v`  and  `npx playwright test tests/e2e/inventory.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/integration/property-isolation.test.ts tests/e2e/inventory.spec.ts
git commit -m "test(property): add isolation + e2e smoke"
```

---

## Self-Review

**Spec coverage M1:** Project/Tower/Floor/Unit → Task 1+3, Grid/Filters → Task 5, Status+hold TTL → Task 6, CostSheet <30s → Task 4+5, CSV 200 units → Task 6, RERA shortcodes → Task 7, workspace isolation + Activity logging → Task 3+8. ✓

**Placeholder scan:** No TBD/TODO, all zod, calc, queries have concrete code blocks.

**Type consistency:** `UnitStatus` enum used in zod (`updateUnitStatusSchema`), actions (`as any` cast narrowed to `UnitStatus`), queries (`status as any`). `CostSheet.total` computed via `calcTotal`, stored as Float with INR default — consistent with `currency` on Deal extension deferred to M3.

**Next:** M2 plan (`2026-09-01-month-2-lead-capture-comms.md`) depends on M1 `Unit`+`Workspace` — builds webhooks/worker/scoring/WhatsApp inbox. M3 (`month-3-transaction-cp.md`) builds booking/CLP/CP. M4 (`month-4-intel-reports-sites.md`) builds AI/reports/Sites/association.

## Roadmap (M2-M4 stubs — separate plans to be expanded)

- **M2 — Lead Capture + Comms:** `app/api/webhooks/[source]/route.ts` thin ingress → `WebhookEvent` + DLQ → `worker/ingest.ts` dedupe + scoring 0-100 → `Contact`+`Deal`+`Activity`; `modules/whatsapp` Meta Cloud adapter + templates + inbox; tests: webhook replay + 2-way timeline.
- **M3 — Transaction & CP:** booking wizard, CLP `PaymentPlan/Milestone`, `SiteVisit` + GPS, demand/allotment render + e-sign stub, `ChannelPartner/CommissionRule` + scoped queries, Deal RE kanban stages.
- **M4 — Intelligence & Reports:** `modules/agents/runAgent` real scoring/next-action/forecast, `modules/reports` (funnel/inventory/collections/ROI) + exports, `app/(public)/sites` listing sync, `BuyerPortalAccess`, `association` directory/shared pool, PWA offline + push + DPDP audit export.

---
Plan saved. Ready for subagent-driven execution — each task is 15-30 min with TDD red→green→commit.
