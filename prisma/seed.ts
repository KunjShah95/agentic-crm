import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../lib/generated/prisma/client"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("DATABASE_URL is not set. Add it to .env first.")
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const DAY = 86_400_000

// Pipeline stages — the real-estate sales loop. "Won"/"Lost" names are
// load-bearing: modules/deals/queries.ts matches the stage literally on "Won".
const STAGES = [
  { name: "Enquiry", color: "#64748b" },
  { name: "Site Visit", color: "#3b82f6" },
  { name: "Hold", color: "#8b5cf6" },
  { name: "Booking", color: "#f59e0b" },
  { name: "Won", color: "#10b981" },
  { name: "Lost", color: "#ef4444" },
]

// Mapping from the old generic-SaaS stage names to the real-estate ones.
const STAGE_RENAMES: Record<string, string> = {
  Lead: "Enquiry",
  Qualified: "Site Visit",
  Proposal: "Hold",
  Negotiation: "Booking",
}

async function main() {
  console.log("🌱 Seeding…")

  const passwordHash = await bcrypt.hash("password123", 12)

  // ── Demo users (personas match the marketing site: Hemal @ Shilp Infra) ──
  const owner = await prisma.user.upsert({
    where: { email: "demo@estate360.com" },
    update: { name: "Hemal Shah", passwordHash },
    create: { email: "demo@estate360.com", name: "Hemal Shah", passwordHash },
  })
  const sales = await prisma.user.upsert({
    where: { email: "sarah@estate360.com" },
    update: { name: "Priya Joshi" },
    create: { email: "sarah@estate360.com", name: "Priya Joshi", passwordHash },
  })

  // ── Cleanup: duplicate personas from the pre-Estate360 "LoopCRM" seed era ─
  for (const email of ["demo@loopcrm.com", "sarah@loopcrm.com"]) {
    const legacy = await prisma.user.findUnique({ where: { email } })
    if (!legacy) continue
    await prisma.deal.updateMany({ where: { ownerId: legacy.id }, data: { ownerId: owner.id } })
    await prisma.workspaceMember.deleteMany({ where: { userId: legacy.id } })
    await prisma.user.delete({ where: { id: legacy.id } })
    console.log(`   Removed legacy user ${email}`)
  }

  // ── Workspace: rename the generic "acme" demo to Shilp Infra ─────────────
  const legacyAcme = await prisma.workspace.findUnique({ where: { slug: "acme" } })
  let workspace = legacyAcme
    ? await prisma.workspace.update({
        where: { id: legacyAcme.id },
        data: { slug: "shilp", name: "Shilp Infra" },
      })
    : await prisma.workspace.findUnique({ where: { slug: "shilp" } })
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Shilp Infra",
        slug: "shilp",
        stages: { create: STAGES.map((s, i) => ({ ...s, order: i })) },
      },
    })
  }

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: owner.id } },
    update: { role: "OWNER" },
    create: { workspaceId: workspace.id, userId: owner.id, role: "OWNER" },
  })
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: sales.id } },
    update: { role: "SALES" },
    create: { workspaceId: workspace.id, userId: sales.id, role: "SALES" },
  })

  // ── Stages: rename legacy generic names, then ensure the canonical six ───
  const before = await prisma.pipelineStage.findMany({ where: { workspaceId: workspace.id } })
  for (const [oldName, newName] of Object.entries(STAGE_RENAMES)) {
    const st = before.find((s) => s.name === oldName)
    const target = before.find((s) => s.name === newName)
    if (!st) continue
    if (target) {
      await prisma.deal.updateMany({ where: { stageId: st.id }, data: { stageId: target.id } })
      await prisma.pipelineStage.delete({ where: { id: st.id } })
    } else {
      await prisma.pipelineStage.update({ where: { id: st.id }, data: { name: newName } })
    }
  }
  const current = await prisma.pipelineStage.findMany({ where: { workspaceId: workspace.id } })
  for (let i = 0; i < STAGES.length; i++) {
    const found = current.find((s) => s.name === STAGES[i].name)
    if (found) {
      await prisma.pipelineStage.update({ where: { id: found.id }, data: { color: STAGES[i].color, order: i } })
    } else {
      await prisma.pipelineStage.create({
        data: { workspaceId: workspace.id, name: STAGES[i].name, color: STAGES[i].color, order: i },
      })
    }
  }
  const stages = await prisma.pipelineStage.findMany({ where: { workspaceId: workspace.id }, orderBy: { order: "asc" } })
  const byName = (name: string) => stages.find((s) => s.name === name)!

  // ── Tags ───────────────────────────────────────────────────────────────────
  const hotTag = await prisma.tag.upsert({
    where: { id: "tag-vip" },
    update: { workspaceId: workspace.id, name: "High Intention", color: "#f59e0b" },
    create: { id: "tag-vip", workspaceId: workspace.id, name: "High Intention", color: "#f59e0b" },
  })
  const nriTag = await prisma.tag.upsert({
    where: { id: "tag-enterprise" },
    update: { workspaceId: workspace.id, name: "NRI", color: "#3b82f6" },
    create: { id: "tag-enterprise", workspaceId: workspace.id, name: "NRI", color: "#3b82f6" },
  })

  // ── Organizations: a corporate buyer + a channel partner ──────────────────
  const spintex = await prisma.organization.upsert({
    where: { id: "org-acme" },
    update: { workspaceId: workspace.id, name: "Gujarat Spintex", domain: "gujspintex.in", industry: "Textiles", size: "201-500", website: "https://gujspintex.in" },
    create: {
      id: "org-acme",
      workspaceId: workspace.id,
      name: "Gujarat Spintex",
      domain: "gujspintex.in",
      industry: "Textiles",
      size: "201-500",
      website: "https://gujspintex.in",
    },
  })
  const jainBrokers = await prisma.organization.upsert({
    where: { id: "org-globex" },
    update: { workspaceId: workspace.id, name: "Jain Brokers", domain: "jainbrokers.in", industry: "Channel Partner", size: "11-50" },
    create: {
      id: "org-globex",
      workspaceId: workspace.id,
      name: "Jain Brokers",
      domain: "jainbrokers.in",
      industry: "Channel Partner",
      size: "11-50",
    },
  })

  // ── Contacts: buyers, an NRI, a broker, a corporate enquiry ───────────────
  const contactDefs = [
    {
      id: "contact-ada",
      firstName: "Anjali", lastName: "Trivedi", email: "anjali.trivedi@example.in",
      phone: "+91 98254 11223", jobTitle: null, organizationId: null,
      leadSource: "Google Ads", leadScore: 82, ownerId: owner.id,
    },
    {
      id: "contact-grace",
      firstName: "Sneha", lastName: "Desai", email: "sneha.desai@example.in",
      phone: "+91 99098 55443", jobTitle: null, organizationId: null,
      leadSource: "WhatsApp", leadScore: 74, ownerId: sales.id,
    },
    {
      id: "contact-alan",
      firstName: "Jaydeep", lastName: "Trivedi", email: "jaydeep@jainbrokers.in",
      phone: "+91 97233 10020", jobTitle: "Channel Partner", organizationId: jainBrokers.id,
      leadSource: "Broker", leadScore: 55, ownerId: sales.id,
    },
    {
      id: "contact-katherine",
      firstName: "Ashish", lastName: "Kothari", email: "ashish.kothari@gujspintex.in",
      phone: "+91 90999 40050", jobTitle: "HR Head", organizationId: spintex.id,
      leadSource: "Walk-in", leadScore: 61, ownerId: owner.id,
    },
    {
      id: "contact-rmehta",
      firstName: "Rohan", lastName: "Mehta", email: "rohan.mehta@example.in",
      phone: "+91 98250 12345", jobTitle: null, organizationId: null,
      leadSource: "Website", leadScore: 90, ownerId: owner.id,
    },
  ] as const
  const contacts: Record<string, { id: string; firstName: string; lastName: string }> = {}
  for (const c of contactDefs) {
    const { id: contactId, ...data } = c
    const row = await prisma.contact.upsert({
      where: { id: contactId },
      update: { ...data },
      create: { id: contactId, ...data, workspaceId: workspace.id, createdBy: owner.id },
    })
    contacts[contactId] = row
  }

  await prisma.contactTag.deleteMany({
    where: { contactId: { in: Object.values(contacts).map((c) => c.id) } },
  })
  await prisma.contactTag.createMany({
    data: [
      { contactId: contacts["contact-ada"].id, tagId: hotTag.id },
      { contactId: contacts["contact-rmehta"].id, tagId: hotTag.id },
      { contactId: contacts["contact-grace"].id, tagId: nriTag.id },
    ],
    skipDuplicates: true,
  })

  // ── Inventory: three Ahmedabad projects, mixed unit statuses ──────────────
  const sky = await prisma.project.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: "Skyline Residences" } },
    update: {
      reraNo: "PR/GJ/AHMEDABAD/AHMEDABADCITY/AUDA/RAA09876/010623",
      address: "Sardar Patel Ring Road, Bopal, Ahmedabad, Gujarat 380058",
      city: "Ahmedabad",
    },
    create: {
      id: "proj-skyline",
      workspaceId: workspace.id,
      name: "Skyline Residences",
      reraNo: "PR/GJ/AHMEDABAD/AHMEDABADCITY/AUDA/RAA09876/010623",
      address: "Sardar Patel Ring Road, Bopal, Ahmedabad, Gujarat 380058",
      city: "Ahmedabad",
      type: "RESIDENTIAL",
    },
  })
  const serenity = await prisma.project.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: "Shilp Serenity" } },
    update: {},
    create: {
      id: "proj-serenity",
      workspaceId: workspace.id,
      name: "Shilp Serenity",
      reraNo: "PR/GJ/AHMEDABAD/AHMEDABADCITY/GIDC/RAA11223/150124",
      address: "SG Highway, Karbintai, Bopal, Ahmedabad, Gujarat 380058",
      city: "Ahmedabad",
      type: "RESIDENTIAL",
    },
  })
  const heights = await prisma.project.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: "Shilp Heights" } },
    update: {},
    create: {
      id: "proj-heights",
      workspaceId: workspace.id,
      name: "Shilp Heights",
      reraNo: "PR/GJ/AHMEDABAD/AHMEDABADCITY/AUDA/RAA13344/220324",
      address: "150ft Ring Road, South Bopal, Ahmedabad, Gujarat 380058",
      city: "Ahmedabad",
      type: "RESIDENTIAL",
    },
  })

  const towerA = await prisma.tower.upsert({
    where: { id: "tower-a" },
    update: { projectId: sky.id, name: "Tower A", floors: 14 },
    create: { id: "tower-a", projectId: sky.id, name: "Tower A", floors: 14 },
  })
  const floor12 = await prisma.floor.upsert({
    where: { towerId_number: { towerId: towerA.id, number: 12 } },
    update: {},
    create: { id: "floor-a-12", towerId: towerA.id, number: 12 },
  })
  await prisma.tower.upsert({
    where: { id: "tower-ss" },
    update: { projectId: serenity.id, name: "Tower SS", floors: 12 },
    create: { id: "tower-ss", projectId: serenity.id, name: "Tower SS", floors: 12 },
  })
  await prisma.tower.upsert({
    where: { id: "tower-sh" },
    update: { projectId: heights.id, name: "Tower SH", floors: 10 },
    create: { id: "tower-sh", projectId: heights.id, name: "Tower SH", floors: 10 },
  })

  // [id, projectId, floorId, unitNo, config, carpet, builtUp, facing, price, status]
  const unitDefs = [
    ["unit-a-1204", sky.id, floor12.id, "A-1204", "BHK3", 1285, 1620, "East", 9_850_000, "BOOKED"],
    ["unit-a-1201", sky.id, floor12.id, "A-1201", "BHK2", 855, 1105, "West", 6_700_000, "AVAILABLE"],
    ["unit-a-1203", sky.id, floor12.id, "A-1203", "BHK3", 1290, 1625, "North", 10_100_000, "SOLD"],
    ["unit-ss-1102", serenity.id, null, "SS-1102", "BHK3", 1320, 1680, "East", 11_500_000, "AVAILABLE"],
    ["unit-ss-207", serenity.id, null, "SS-207", "BHK1", 620, 810, "West", 4_150_000, "HOLD"],
    ["unit-ss-704", serenity.id, null, "SS-704", "BHK2", 905, 1160, "North", 7_250_000, "AVAILABLE"],
    ["unit-sh-405", heights.id, null, "SH-405", "BHK2", 880, 1140, "East", 6_450_000, "AVAILABLE"],
    ["unit-sh-1201", heights.id, null, "SH-1201", "BHK4", 1760, 2210, "West", 14_500_000, "HOLD"],
    ["unit-sh-302", heights.id, null, "SH-302", "BHK3", 1240, 1590, "North", 9_300_000, "SOLD"],
  ] as const
  const units: Record<string, { id: string; unitNo: string; carpetArea: number | null; builtUp: number | null }> = {}
  for (const [id, projectId, floorId, unitNo, config, carpetArea, builtUp, facing, price, status] of unitDefs) {
    const u = await prisma.unit.upsert({
      where: { projectId_unitNo: { projectId, unitNo } },
      update: { workspaceId: workspace.id, floorId, config, carpetArea, builtUp, facing, price, status },
      create: { id, workspaceId: workspace.id, projectId, floorId, unitNo, config, carpetArea, builtUp, facing, price, status },
    })
    units[id] = u
  }

  // ── Deals: the full enquiry→booking loop, all INR ─────────────────────────
  const dealDefs = [
    {
      id: "deal-1",
      title: "Skyline Residences — A-1204 · 3BHK",
      contactId: contacts["contact-rmehta"].id, organizationId: null,
      unitId: units["unit-a-1204"].id, stage: "Won", bookingStage: "BOOKING",
      value: 9_850_000, probability: 100, closeOffset: -5, ownerId: owner.id,
    },
    {
      id: "deal-2",
      title: "Shilp Serenity — 3BHK SS-1102",
      contactId: contacts["contact-ada"].id, organizationId: null,
      unitId: units["unit-ss-1102"].id, stage: "Booking", bookingStage: "BOOKING",
      value: 11_500_000, probability: 90, closeOffset: 14, ownerId: owner.id,
    },
    {
      id: "deal-3",
      title: "Shilp Heights — 2BHK SH-405",
      contactId: contacts["contact-grace"].id, organizationId: null,
      unitId: units["unit-sh-405"].id, stage: "Hold", bookingStage: "HOLD",
      value: 6_450_000, probability: 60, closeOffset: 30, ownerId: sales.id,
    },
    {
      id: "deal-4",
      title: "Shilp Serenity — 1BHK SS-207",
      contactId: contacts["contact-alan"].id, organizationId: jainBrokers.id,
      unitId: units["unit-ss-207"].id, stage: "Site Visit", bookingStage: "VISIT",
      value: 4_150_000, probability: 30, closeOffset: 45, ownerId: sales.id,
    },
    {
      id: "deal-5",
      title: "Gujarat Spintex — corporate enquiry (staff housing)",
      contactId: contacts["contact-katherine"].id, organizationId: spintex.id,
      unitId: null, stage: "Enquiry", bookingStage: "INQUIRY",
      value: 26_000_000, probability: 10, closeOffset: 90, ownerId: owner.id,
    },
    {
      id: "deal-6",
      title: "Shilp Heights — Penthouse SH-1201",
      contactId: contacts["contact-grace"].id, organizationId: null,
      unitId: units["unit-sh-1201"].id, stage: "Hold", bookingStage: "HOLD",
      value: 14_500_000, probability: 55, closeOffset: 21, ownerId: sales.id,
    },
    {
      id: "deal-7",
      title: "Skyline Residences — A-1201 · 2BHK",
      contactId: contacts["contact-ada"].id, organizationId: null,
      unitId: units["unit-a-1201"].id, stage: "Site Visit", bookingStage: "VISIT",
      value: 6_700_000, probability: 40, closeOffset: 35, ownerId: owner.id,
    },
  ] as const
  const deals: Record<string, { id: string }> = {}
  for (const d of dealDefs) {
    const row = await prisma.deal.upsert({
      where: { id: d.id },
      update: {
        workspaceId: workspace.id,
        title: d.title,
        contactId: d.contactId,
        organizationId: d.organizationId,
        unitId: d.unitId,
        stageId: byName(d.stage).id,
        bookingStage: d.bookingStage,
        value: d.value,
        currency: "INR",
        probability: d.probability,
        expectedCloseDate: new Date(Date.now() + d.closeOffset * DAY),
        ownerId: d.ownerId,
      },
      create: {
        id: d.id,
        workspaceId: workspace.id,
        title: d.title,
        contactId: d.contactId,
        organizationId: d.organizationId,
        unitId: d.unitId,
        stageId: byName(d.stage).id,
        bookingStage: d.bookingStage,
        value: d.value,
        currency: "INR",
        probability: d.probability,
        expectedCloseDate: new Date(Date.now() + d.closeOffset * DAY),
        ownerId: d.ownerId,
      },
    })
    deals[d.id] = row
  }

  // Legacy generic-SaaS deals (Acme/Globex/NASA in USD) are superseded.
  for (const legacyId of ["deal-skyline-1204"]) {
    const exists = await prisma.deal.findUnique({ where: { id: legacyId } })
    if (exists) {
      await prisma.activity.deleteMany({ where: { dealId: legacyId } })
      await prisma.dealTag.deleteMany({ where: { dealId: legacyId } })
      await prisma.generatedDocument.deleteMany({ where: { dealId: legacyId } })
      await prisma.costSheet.deleteMany({ where: { dealId: legacyId } })
      await prisma.payment.deleteMany({ where: { dealId: legacyId } })
      await prisma.deal.delete({ where: { id: legacyId } })
    }
  }
  {
    const usd = await prisma.deal.findMany({ where: { workspaceId: workspace.id, currency: "USD" }, select: { id: true } })
    for (const d of usd) {
      await prisma.activity.deleteMany({ where: { dealId: d.id } })
      await prisma.dealTag.deleteMany({ where: { dealId: d.id } })
      await prisma.generatedDocument.deleteMany({ where: { dealId: d.id } })
      await prisma.costSheet.deleteMany({ where: { dealId: d.id } })
      await prisma.payment.deleteMany({ where: { dealId: d.id } })
      await prisma.deal.delete({ where: { id: d.id } })
    }
  }

  await prisma.dealTag.deleteMany({ where: { dealId: { in: dealDefs.map((d) => d.id) } } })
  await prisma.dealTag.createMany({
    data: [
      { dealId: deals["deal-2"].id, tagId: hotTag.id },
      { dealId: deals["deal-3"].id, tagId: nriTag.id },
    ],
    skipDuplicates: true,
  })

  // ── Collections: CLP milestones on the A-1204 booking (paid/due/overdue) ──
  const bookedDeal = deals["deal-1"]
  await prisma.payment.deleteMany({ where: { dealId: bookedDeal.id, receiptNo: { startsWith: "SEED-" } } })
  const milestones = [
    { receipt: "SEED-1", amount: 985_000, status: "PAID", dueDays: -45 },
    { receipt: "SEED-2", amount: 1_477_500, status: "PAID", dueDays: -20 },
    { receipt: "SEED-3", amount: 985_000, status: "DUE", dueDays: -6 }, // overdue
    { receipt: "SEED-4", amount: 985_000, status: "DUE", dueDays: 12 },
  ]
  for (const m of milestones) {
    await prisma.payment.create({
      data: {
        workspaceId: workspace.id,
        dealId: bookedDeal.id,
        amount: m.amount,
        status: m.status,
        dueDate: new Date(Date.now() + m.dueDays * DAY),
        paidAt: m.status === "PAID" ? new Date(Date.now() + m.dueDays * DAY) : null,
        receiptNo: m.receipt,
      },
    })
  }

  // ── Plan limits (platform rows, idempotent) ────────────────────────────────
  for (const row of [
    { plan: "free", maxSeats: 1, maxContacts: 500, maxSocialAccounts: 1, msgPerMonth: 100, webhookPerDay: 500, agentCreditsPerMo: 0 },
    { plan: "pro", maxSeats: 5, maxContacts: 5000, maxSocialAccounts: 3, msgPerMonth: 5000, webhookPerDay: 10000, agentCreditsPerMo: 1000 },
    { plan: "scale", maxSeats: 15, maxContacts: 25000, maxSocialAccounts: 10, msgPerMonth: 25000, webhookPerDay: 50000, agentCreditsPerMo: 10000 },
  ] as const) {
    await prisma.planLimits.upsert({ where: { plan: row.plan }, update: row, create: row })
  }

  // ── Activities: drop the old generic-SaaS seed chatter, keep the loop story
  await prisma.activity.deleteMany({
    where: {
      workspaceId: workspace.id,
      OR: [
        { body: { contains: "SSO" } },
        { body: { contains: "comparison to their current tool" } },
        { body: { contains: "case study" } },
        { body: { contains: "enterprise terms" } },
        { body: { contains: 'Moved deal from "Proposal"' } },
      ],
    },
  })

  // ── Activities (idempotent: fixed ids, source="seed") ──────────────────────
  await prisma.activity.deleteMany({ where: { workspaceId: workspace.id, source: "seed" } })
  const activityDefs = [
    { id: "act-seed-1", type: "CALL", contactId: contacts["contact-ada"].id, dealId: deals["deal-2"].id, body: "Site visit done at Serenity — Anjali confirmed the east-facing 3BHK. Demand letter goes out Monday.", createdBy: owner.id, at: -2 },
    { id: "act-seed-2", type: "NOTE", contactId: contacts["contact-grace"].id, dealId: deals["deal-3"].id, body: "Cost sheet with GST + stamp shared over WhatsApp. NRI — repatriation query answered.", createdBy: sales.id, at: -3 },
    { id: "act-seed-3", type: "CALL", contactId: contacts["contact-katherine"].id, dealId: deals["deal-5"].id, body: "Spintex wants 4 units for relocated managers. Budget ≤ ₹65L each, SG Highway preferred.", createdBy: owner.id, at: -1 },
    { id: "act-seed-4", type: "TASK", contactId: contacts["contact-rmehta"].id, dealId: deals["deal-1"].id, body: "Issue demand letter #3 (SLI-1 overdue by 6 days) for A-1204", createdBy: owner.id, assigneeId: owner.id, at: 1 },
    { id: "act-seed-5", type: "TASK", contactId: contacts["contact-alan"].id, dealId: deals["deal-4"].id, body: "Release SH-405 hold before expiry or convert to booking", createdBy: sales.id, assigneeId: sales.id, at: 2 },
    { id: "act-seed-6", type: "TASK", contactId: contacts["contact-katherine"].id, dealId: deals["deal-5"].id, body: "Send corporate housing proposal to Gujarat Spintex HR", createdBy: owner.id, assigneeId: sales.id, at: 4 },
  ] as const
  for (const a of activityDefs) {
    await prisma.activity.create({
      data: {
        id: a.id,
        workspaceId: workspace.id,
        type: a.type,
        contactId: a.contactId,
        dealId: a.dealId,
        body: a.body,
        createdBy: a.createdBy,
        source: "seed",
        createdAt: new Date(Date.now() + a.at * DAY),
        ...(a.type === "TASK"
          ? { scheduledAt: new Date(Date.now() + a.at * DAY), assigneeId: a.assigneeId ?? a.createdBy }
          : {}),
      },
    })
  }

  // ── RERA documents: templates + a generated allotment letter ───────────────
  const TEMPLATES: { id: string; kind: "DEMAND_LETTER" | "ALLOTMENT" | "BOOKING_FORM" | "RECEIPT" | "POSSESSION"; name: string; bodyHtml: string }[] = [
    {
      id: "tpl-demand",
      kind: "DEMAND_LETTER",
      name: "Demand Letter (CLP Milestone)",
      bodyHtml: `<h1>{{workspace_name}}</h1><div class="muted">RERA Reg. No. {{rera_no}}</div><hr />
<h2>Demand Letter</h2>
<p>Date: {{booking_date}}</p>
<p>To,<br /><strong>{{buyer_name}}</strong></p>
<p>Sub: Payment demand towards <strong>Unit {{unit_no}}, {{project_name}}</strong> as per the agreed Construction Linked Payment plan.</p>
<p>Dear {{buyer_name}},</p>
<p>As per the payment schedule for your booked unit, the following amount is now due against the milestone <strong>"{{milestone}}"</strong>:</p>
<table><tr><th>Description</th><th class="right">Amount (₹)</th></tr>
<tr><td>Unit {{unit_no}} — {{project_name}}</td><td class="right">{{demand_amount}}</td></tr>
<tr><td>Agreement Value (for reference)</td><td class="right">{{total}}</td></tr></table>
<p>Kindly remit the above amount within 15 days of this notice. Cheques/NEFT to be drawn in favour of the RERA-designated project account.</p>
<div class="sign-row"><div class="sign-box">Authorised Signatory<br />{{workspace_name}}</div><div class="sign-box">Received by</div></div>`,
    },
    {
      id: "tpl-allotment",
      kind: "ALLOTMENT",
      name: "Allotment Letter",
      bodyHtml: `<h1>{{workspace_name}}</h1><div class="muted">RERA Reg. No. {{rera_no}}</div><hr />
<h2>Allotment Letter</h2>
<p>Date: {{booking_date}}</p>
<p>Dear <strong>{{buyer_name}}</strong>,</p>
<p>We are pleased to confirm the provisional allotment of the following residential unit in <strong>{{project_name}}</strong>, subject to the terms of the Agreement for Sale executed under the Real Estate (Regulation and Development) Act, 2016.</p>
<table><tr><th>Particular</th><th>Detail</th></tr>
<tr><td>Unit No.</td><td>{{unit_no}}</td></tr>
<tr><td>Carpet Area (RERA)</td><td>{{carpet_area}} sq. ft.</td></tr>
<tr><td>Built-up Area</td><td>{{built_up}} sq. ft.</td></tr>
<tr><td>Base Price</td><td>₹ {{base_price}}</td></tr>
<tr><td>GST</td><td>₹ {{gst}}</td></tr>
<tr><td>Stamp Duty</td><td>₹ {{stamp_duty}}</td></tr>
<tr><td><strong>Total Consideration</strong></td><td><strong>₹ {{total}}</strong></td></tr></table>
<p>This allotment is subject to timely payment as per the agreed schedule.</p>
<div class="sign-row"><div class="sign-box">For {{workspace_name}}<br />Authorised Signatory</div><div class="sign-box">Allottee<br />{{buyer_name}}</div></div>`,
    },
    {
      id: "tpl-booking",
      kind: "BOOKING_FORM",
      name: "Booking Application Form",
      bodyHtml: `<h1>{{workspace_name}}</h1><div class="muted">RERA Reg. No. {{rera_no}}</div><hr />
<h2>Booking Application Form</h2>
<p>Date: {{booking_date}}</p>
<table><tr><th>Applicant Name</th><td>{{buyer_name}}</td></tr>
<tr><th>Project</th><td>{{project_name}}</td></tr>
<tr><th>Unit</th><td>{{unit_no}} ({{carpet_area}} sq. ft. carpet)</td></tr>
<tr><th>Total Consideration</th><td>₹ {{total}}</td></tr></table>
<p>I/We hereby apply for the booking of the above unit and agree to abide by the terms and conditions of the Agreement for Sale under RERA, 2016. I/We confirm that the RERA registration and project details have been disclosed to me/us.</p>
<div class="sign-row"><div class="sign-box">Applicant Signature<br />{{buyer_name}}</div><div class="sign-box">For {{workspace_name}}</div></div>`,
    },
    {
      id: "tpl-receipt",
      kind: "RECEIPT",
      name: "Payment Receipt",
      bodyHtml: `<h1>{{workspace_name}}</h1><div class="muted">RERA Reg. No. {{rera_no}}</div><hr />
<h2>Payment Receipt</h2>
<p>Receipt No.: {{receipt_no}} &nbsp;·&nbsp; Date: {{booking_date}}</p>
<p>Received with thanks from <strong>{{buyer_name}}</strong> the following sum towards Unit <strong>{{unit_no}}</strong>, {{project_name}}:</p>
<table><tr><th>Towards</th><th class="right">Amount (₹)</th></tr>
<tr><td>{{milestone}}</td><td class="right">{{demand_amount}}</td></tr></table>
<p class="muted">Subject to realisation of instrument. This receipt is computer-generated.</p>
<div class="sign-row"><div class="sign-box">Authorised Signatory<br />{{workspace_name}}</div><div class="sign-box"></div></div>`,
    },
    {
      id: "tpl-possession",
      kind: "POSSESSION",
      name: "Possession Letter",
      bodyHtml: `<h1>{{workspace_name}}</h1><div class="muted">RERA Reg. No. {{rera_no}}</div><hr />
<h2>Offer of Possession</h2>
<p>Date: {{booking_date}}</p>
<p>Dear <strong>{{buyer_name}}</strong>,</p>
<p>We are pleased to inform you that <strong>Unit {{unit_no}}</strong> in <strong>{{project_name}}</strong> is ready for possession, the project having received its occupancy certificate. You are requested to complete the balance payment and formalities to take handover.</p>
<table><tr><th>Unit</th><td>{{unit_no}} ({{built_up}} sq. ft.)</td></tr>
<tr><th>Total Consideration</th><td>₹ {{total}}</td></tr></table>
<p>Kindly contact our office to schedule the handover and joint inspection.</p>
<div class="sign-row"><div class="sign-box">For {{workspace_name}}<br />Authorised Signatory</div><div class="sign-box">Allottee<br />{{buyer_name}}</div></div>`,
    },
  ]
  for (const t of TEMPLATES) {
    await prisma.documentTemplate.upsert({
      where: { id: t.id },
      update: { name: t.name, bodyHtml: t.bodyHtml, kind: t.kind, reraAligned: true },
      create: { id: t.id, workspaceId: workspace.id, kind: t.kind, name: t.name, bodyHtml: t.bodyHtml, reraAligned: true },
    })
  }

  const unit = await prisma.unit.findUniqueOrThrow({ where: { id: units["unit-a-1204"].id } })
  const costSheet = await prisma.costSheet.upsert({
    where: { id: "cost-skyline-1204" },
    update: { workspaceId: workspace.id, unitId: unit.id, dealId: bookedDeal.id, basePrice: 9_850_000, gst: 492_500, stampDuty: 482_650, total: 10_825_150, currency: "INR" },
    create: {
      id: "cost-skyline-1204",
      workspaceId: workspace.id,
      unitId: unit.id,
      dealId: bookedDeal.id,
      basePrice: 9_850_000,
      gst: 492_500, // 5%
      stampDuty: 482_650, // ~4.9%
      total: 10_825_150,
      currency: "INR",
    },
  })

  const inr = (n: number) => n.toLocaleString("en-IN")
  const allotmentCtx: Record<string, string> = {
    workspace_name: workspace.name,
    rera_no: sky.reraNo ?? "",
    project_name: sky.name,
    unit_no: unit.unitNo,
    carpet_area: String(unit.carpetArea ?? ""),
    built_up: String(unit.builtUp ?? ""),
    base_price: inr(costSheet.basePrice),
    gst: inr(costSheet.gst),
    stamp_duty: inr(costSheet.stampDuty),
    total: inr(costSheet.total),
    buyer_name: `${contacts["contact-rmehta"].firstName} ${contacts["contact-rmehta"].lastName}`,
    booking_date: new Date().toLocaleDateString("en-IN"),
  }
  const allotmentTpl = TEMPLATES.find((t) => t.id === "tpl-allotment")!
  let allotmentHtml = allotmentTpl.bodyHtml
  for (const [k, v] of Object.entries(allotmentCtx)) allotmentHtml = allotmentHtml.replaceAll(`{{${k}}}`, v)
  await prisma.generatedDocument.upsert({
    where: { id: "gen-allotment-1204" },
    update: { workspaceId: workspace.id, dealId: bookedDeal.id, unitId: unit.id, renderedHtml: allotmentHtml },
    create: {
      id: "gen-allotment-1204",
      workspaceId: workspace.id,
      dealId: bookedDeal.id,
      unitId: unit.id,
      templateId: allotmentTpl.id,
      renderedHtml: allotmentHtml,
    },
  })

  console.log("✅ Seed complete.")
  console.log("   Login: demo@estate360.com / password123")
  console.log("   Workspace: /shilp — Shilp Infra (3 projects · 9 units · 7 deals · CLP collections)")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
