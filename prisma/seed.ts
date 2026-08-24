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
    where: { email: "demo@loopcrm.com" },
    update: { name: "Alex Morgan", passwordHash },
    create: {
      email: "demo@loopcrm.com",
      name: "Alex Morgan",
      passwordHash,
    },
  })

  const sarah = await prisma.user.upsert({
    where: { email: "sarah@loopcrm.com" },
    update: { name: "Sarah Chen" },
    create: {
      email: "sarah@loopcrm.com",
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

  console.log("✅ Seed complete.")
  console.log("   Login: demo@loopcrm.com / password123")
  console.log("   Workspace: /acme")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
