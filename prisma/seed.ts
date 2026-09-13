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

const STAGES = [
  { name: "Lead", color: "#64748b" },
  { name: "Qualified", color: "#3b82f6" },
  { name: "Proposal", color: "#8b5cf6" },
  { name: "Negotiation", color: "#f59e0b" },
  { name: "Won", color: "#10b981" },
  { name: "Lost", color: "#ef4444" },
]

async function main() {
  console.log("🌱 Seeding…")

  const passwordHash = await bcrypt.hash("password123", 12)

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@estate360.com" },
    update: { name: "Alex Morgan", passwordHash },
    create: {
      email: "demo@estate360.com",
      name: "Alex Morgan",
      passwordHash,
    },
  })

  const sarah = await prisma.user.upsert({
    where: { email: "sarah@estate360.com" },
    update: { name: "Sarah Chen" },
    create: {
      email: "sarah@estate360.com",
      name: "Sarah Chen",
      passwordHash,
    },
  })

  const workspace = await prisma.workspace.upsert({
    where: { slug: "acme" },
    update: { name: "Acme Inc." },
    create: {
      name: "Acme Inc.",
      slug: "acme",
      stages: { create: STAGES.map((s, i) => ({ ...s, order: i })) },
    },
  })

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: demoUser.id },
    },
    update: {},
    create: { workspaceId: workspace.id, userId: demoUser.id, role: "OWNER" },
  })
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: sarah.id },
    },
    update: {},
    create: { workspaceId: workspace.id, userId: sarah.id, role: "MEMBER" },
  })

  // Tags
  const vipTag = await prisma.tag.upsert({
    where: { id: "tag-vip" },
    update: {},
    create: { id: "tag-vip", workspaceId: workspace.id, name: "VIP", color: "#f59e0b" },
  })
  const enterpriseTag = await prisma.tag.upsert({
    where: { id: "tag-enterprise" },
    update: {},
    create: {
      id: "tag-enterprise",
      workspaceId: workspace.id,
      name: "Enterprise",
      color: "#3b82f6",
    },
  })

  // Organizations
  const acmeCorp = await prisma.organization.upsert({
    where: { id: "org-acme" },
    update: {},
    create: {
      id: "org-acme",
      workspaceId: workspace.id,
      name: "Acme Corp",
      domain: "acme.com",
      industry: "Software",
      size: "201-500",
      website: "https://acme.com",
    },
  })
  const globex = await prisma.organization.upsert({
    where: { id: "org-globex" },
    update: {},
    create: {
      id: "org-globex",
      workspaceId: workspace.id,
      name: "Globex",
      domain: "globex.io",
      industry: "Fintech",
      size: "51-200",
    },
  })

  // Contacts
  const ada = await prisma.contact.upsert({
    where: { id: "contact-ada" },
    update: {},
    create: {
      id: "contact-ada",
      workspaceId: workspace.id,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@acme.com",
      phone: "+1 555 010 0101",
      jobTitle: "CTO",
      organizationId: acmeCorp.id,
      ownerId: demoUser.id,
      createdBy: demoUser.id,
    },
  })
  const grace = await prisma.contact.upsert({
    where: { id: "contact-grace" },
    update: {},
    create: {
      id: "contact-grace",
      workspaceId: workspace.id,
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@acme.com",
      jobTitle: "VP Engineering",
      organizationId: acmeCorp.id,
      ownerId: demoUser.id,
      createdBy: demoUser.id,
    },
  })
  const alan = await prisma.contact.upsert({
    where: { id: "contact-alan" },
    update: {},
    create: {
      id: "contact-alan",
      workspaceId: workspace.id,
      firstName: "Alan",
      lastName: "Turing",
      email: "alan@globex.io",
      jobTitle: "Head of Product",
      organizationId: globex.id,
      ownerId: sarah.id,
      createdBy: demoUser.id,
    },
  })
  const katherine = await prisma.contact.upsert({
    where: { id: "contact-katherine" },
    update: {},
    create: {
      id: "contact-katherine",
      workspaceId: workspace.id,
      firstName: "Katherine",
      lastName: "Johnson",
      email: "katherine@nasa.gov",
      jobTitle: "Director of Research",
      ownerId: demoUser.id,
      createdBy: demoUser.id,
    },
  })

  await prisma.contactTag.createMany({
    data: [
      { contactId: ada.id, tagId: vipTag.id },
      { contactId: ada.id, tagId: enterpriseTag.id },
      { contactId: alan.id, tagId: enterpriseTag.id },
    ],
    skipDuplicates: true,
  })

  // Stages for the workspace
  const stages = await prisma.pipelineStage.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { order: "asc" },
  })
  const byName = (name: string) => stages.find((s) => s.name === name)!

  // Deals
  const deal1 = await prisma.deal.upsert({
    where: { id: "deal-1" },
    update: {},
    create: {
      id: "deal-1",
      workspaceId: workspace.id,
      title: "Acme Corp — enterprise platform",
      contactId: ada.id,
      organizationId: acmeCorp.id,
      stageId: byName("Negotiation").id,
      value: 48000,
      currency: "USD",
      probability: 70,
      expectedCloseDate: new Date(Date.now() + 14 * 86_400_000),
      ownerId: demoUser.id,
    },
  })
  const deal2 = await prisma.deal.upsert({
    where: { id: "deal-2" },
    update: {},
    create: {
      id: "deal-2",
      workspaceId: workspace.id,
      title: "Globex — annual plan",
      contactId: alan.id,
      organizationId: globex.id,
      stageId: byName("Proposal").id,
      value: 24000,
      currency: "USD",
      probability: 50,
      expectedCloseDate: new Date(Date.now() + 30 * 86_400_000),
      ownerId: sarah.id,
    },
  })
  await prisma.deal.upsert({
    where: { id: "deal-3" },
    update: {},
    create: {
      id: "deal-3",
      workspaceId: workspace.id,
      title: "Acme Corp — team seats",
      contactId: grace.id,
      organizationId: acmeCorp.id,
      stageId: byName("Qualified").id,
      value: 12000,
      currency: "USD",
      probability: 30,
      ownerId: demoUser.id,
    },
  })
  await prisma.deal.upsert({
    where: { id: "deal-4" },
    update: {},
    create: {
      id: "deal-4",
      workspaceId: workspace.id,
      title: "NASA — pilot program",
      contactId: katherine.id,
      stageId: byName("Won").id,
      value: 96000,
      currency: "USD",
      probability: 100,
      expectedCloseDate: new Date(Date.now() - 5 * 86_400_000),
      ownerId: demoUser.id,
    },
  })

  await prisma.dealTag.createMany({
    data: [
      { dealId: deal1.id, tagId: enterpriseTag.id },
      { dealId: deal2.id, tagId: enterpriseTag.id },
    ],
    skipDuplicates: true,
  })

  // PlanLimits seed (idempotent)
  for (const row of [
    { plan: "free", maxSeats: 1, maxContacts: 500, maxSocialAccounts: 1, msgPerMonth: 100, webhookPerDay: 500, agentCreditsPerMo: 0 },
    { plan: "pro", maxSeats: 5, maxContacts: 5000, maxSocialAccounts: 3, msgPerMonth: 5000, webhookPerDay: 10000, agentCreditsPerMo: 1000 },
    { plan: "scale", maxSeats: 15, maxContacts: 25000, maxSocialAccounts: 10, msgPerMonth: 25000, webhookPerDay: 50000, agentCreditsPerMo: 10000 },
  ] as const) {
    await prisma.planLimits.upsert({
      where: { plan: row.plan },
      update: row,
      create: row,
    })
  }

  // Activities
  await prisma.activity.createMany({
    data: [
      {
        workspaceId: workspace.id,
        type: "NOTE",
        contactId: ada.id,
        dealId: deal1.id,
        body: "Discovery call went well — Ada wants SSO and audit logs before moving forward.",
        createdBy: demoUser.id,
      },
      {
        workspaceId: workspace.id,
        type: "EMAIL",
        contactId: alan.id,
        dealId: deal2.id,
        body: "Sent pricing overview and a comparison to their current tool.",
        createdBy: sarah.id,
      },
      {
        workspaceId: workspace.id,
        type: "CALL",
        contactId: katherine.id,
        body: "Champion on board. Referencing her for the NASA case study.",
        createdBy: demoUser.id,
      },
      {
        workspaceId: workspace.id,
        type: "TASK",
        contactId: ada.id,
        dealId: deal1.id,
        body: "Send revised contract with enterprise terms",
        scheduledAt: new Date(Date.now() + 2 * 86_400_000),
        assigneeId: demoUser.id,
        createdBy: demoUser.id,
      },
      {
        workspaceId: workspace.id,
        type: "TASK",
        dealId: deal1.id,
        body: `Moved deal from "Proposal" to "Negotiation"`,
        createdBy: demoUser.id,
      },
    ],
    skipDuplicates: true,
  })

  // ── Real-estate inventory + RERA documents ────────────────────────────────
  // Gives the Documents page real, presentable content (not empty/placeholder).
  const project = await prisma.project.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: "Skyline Residences" } },
    update: {},
    create: {
      id: "proj-skyline",
      workspaceId: workspace.id,
      name: "Skyline Residences",
      reraNo: "PR/GJ/AHMEDABAD/AHMEDABADCITY/AUDA/RAA12345/010124",
      address: "Sardar Patel Ring Road, Bopal, Ahmedabad, Gujarat 380058",
      city: "Ahmedabad",
      type: "RESIDENTIAL",
    },
  })
  const tower = await prisma.tower.upsert({
    where: { id: "tower-a" },
    update: {},
    create: { id: "tower-a", projectId: project.id, name: "Tower A", floors: 14 },
  })
  const floor = await prisma.floor.upsert({
    where: { towerId_number: { towerId: tower.id, number: 12 } },
    update: {},
    create: { id: "floor-a-12", towerId: tower.id, number: 12 },
  })
  const unit = await prisma.unit.upsert({
    where: { projectId_unitNo: { projectId: project.id, unitNo: "A-1204" } },
    update: {},
    create: {
      id: "unit-a-1204",
      workspaceId: workspace.id,
      projectId: project.id,
      floorId: floor.id,
      unitNo: "A-1204",
      config: "BHK3",
      carpetArea: 1285,
      builtUp: 1620,
      facing: "East",
      price: 9_850_000,
      status: "BOOKED",
    },
  })

  const buyer = await prisma.contact.upsert({
    where: { id: "contact-rmehta" },
    update: {},
    create: {
      id: "contact-rmehta",
      workspaceId: workspace.id,
      firstName: "Rohan",
      lastName: "Mehta",
      email: "rohan.mehta@example.in",
      phone: "+91 98250 12345",
      ownerId: demoUser.id,
      createdBy: demoUser.id,
    },
  })
  const reDeal = await prisma.deal.upsert({
    where: { id: "deal-skyline-1204" },
    update: {},
    create: {
      id: "deal-skyline-1204",
      workspaceId: workspace.id,
      title: "Skyline A-1204 — 3BHK booking",
      contactId: buyer.id,
      stageId: byName("Won").id,
      unitId: unit.id,
      value: 9_850_000,
      currency: "INR",
      probability: 100,
      ownerId: demoUser.id,
    },
  })
  const costSheet = await prisma.costSheet.upsert({
    where: { id: "cost-skyline-1204" },
    update: {},
    create: {
      id: "cost-skyline-1204",
      workspaceId: workspace.id,
      unitId: unit.id,
      dealId: reDeal.id,
      basePrice: 9_850_000,
      gst: 492_500, // 5%
      stampDuty: 482_650, // ~4.9%
      total: 10_825_150,
      currency: "INR",
    },
  })

  // RERA-aligned document templates (shortcodes rendered at generation time).
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

  // One pre-generated allotment letter so the Documents page has real content.
  const inr = (n: number) => n.toLocaleString("en-IN")
  const allotmentCtx: Record<string, string> = {
    workspace_name: workspace.name,
    rera_no: project.reraNo ?? "",
    project_name: project.name,
    unit_no: unit.unitNo,
    carpet_area: String(unit.carpetArea ?? ""),
    built_up: String(unit.builtUp ?? ""),
    base_price: inr(costSheet.basePrice),
    gst: inr(costSheet.gst),
    stamp_duty: inr(costSheet.stampDuty),
    total: inr(costSheet.total),
    buyer_name: `${buyer.firstName} ${buyer.lastName}`,
    booking_date: new Date().toLocaleDateString("en-IN"),
  }
  const allotmentTpl = TEMPLATES.find((t) => t.id === "tpl-allotment")!
  let allotmentHtml = allotmentTpl.bodyHtml
  for (const [k, v] of Object.entries(allotmentCtx)) allotmentHtml = allotmentHtml.replaceAll(`{{${k}}}`, v)
  await prisma.generatedDocument.upsert({
    where: { id: "gen-allotment-1204" },
    update: { renderedHtml: allotmentHtml },
    create: {
      id: "gen-allotment-1204",
      workspaceId: workspace.id,
      dealId: reDeal.id,
      unitId: unit.id,
      templateId: allotmentTpl.id,
      renderedHtml: allotmentHtml,
    },
  })

  console.log("✅ Seed complete.")
  console.log("   Login: demo@estate360.com / password123")
  console.log("   Workspace: /acme")
  console.log("   Seeded: Skyline Residences · 5 RERA templates · 1 allotment letter")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
