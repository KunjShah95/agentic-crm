/**
 * Lead ingest worker — consumes a webhook lead payload and materializes it
 * into Contact + Deal + Activity, workspace-scoped, with dedupe + scoring +
 * routing + consent audit. Called by the queue consumer or synchronously in
 * dev. Never throws to the provider; failures are recorded on WebhookEvent.
 */

import { db } from "@/lib/db"
import { normalizeLead } from "./normalize"
import { calcLeadScore } from "./scoring"
import { pickAssignee, type RoutableMember, type RoutingStrategy } from "./routing"

export type ProcessLeadInput = {
  workspaceId: string
  source: string
  payload: unknown
  strategy?: RoutingStrategy
}

export type ProcessLeadResult = {
  deduped: boolean
  contactId?: string
  dealId?: string
  score?: number
}

export async function processLead(input: ProcessLeadInput): Promise<ProcessLeadResult> {
  const { workspaceId, source, payload, strategy = "ROUND_ROBIN" } = input
  const lead = normalizeLead(source, payload)

  // 1. Dedupe on WebhookEvent.dedupeKey
  const existing = await db.webhookEvent.findUnique({ where: { dedupeKey: lead.dedupeKey } })
  if (existing?.processedAt) {
    return { deduped: true }
  }
  if (!existing) {
    await db.webhookEvent.create({
      data: { workspaceId, source: lead.source, payload: lead.raw as object, dedupeKey: lead.dedupeKey, status: "PROCESSING", attempts: 1 },
    })
  }

  try {
    // 2. Score
    const score = calcLeadScore({
      source: lead.source,
      intent: lead.intent,
      config: lead.config,
      budgetMin: lead.budgetMin,
      budgetMax: lead.budgetMax,
      locality: lead.locality,
    })

    // 3. Route → assignee
    const members = (await db.workspaceMember.findMany({ where: { workspaceId } })) as RoutableMember[]
    const counter = await db.deal.count({ where: { workspaceId } })
    const assigneeId = pickAssignee(members, { strategy, counter, locality: lead.locality }) ?? members[0]?.userId

    // 4. Find or create Contact (match by phone or email within workspace)
    const orConds: Array<Record<string, string>> = []
    if (lead.phone) orConds.push({ phone: lead.phone })
    if (lead.email) orConds.push({ email: lead.email })
    let contact = orConds.length
      ? await db.contact.findFirst({ where: { workspaceId, OR: orConds } })
      : null

    if (!contact) {
      contact = await db.contact.create({
        data: {
          workspaceId,
          firstName: lead.firstName,
          lastName: lead.lastName,
          phone: lead.phone ?? null,
          email: lead.email ?? null,
          leadSource: lead.source,
          leadScore: score,
          ownerId: assigneeId ?? null,
          requirementsJson: {
            project: lead.project ?? null,
            config: lead.config ?? null,
            locality: lead.locality ?? null,
            intent: lead.intent ?? null,
            budgetMin: lead.budgetMin ?? null,
            budgetMax: lead.budgetMax ?? null,
          },
          createdBy: "system",
        },
      })
    } else {
      await db.contact.update({ where: { id: contact.id }, data: { leadScore: score } })
    }

    // 5. Create Deal in first pipeline stage
    let dealId: string | undefined
    const stage = await db.pipelineStage.findFirst({ where: { workspaceId }, orderBy: { order: "asc" } })
    if (stage && assigneeId) {
      const deal = await db.deal.create({
        data: {
          workspaceId,
          title: `${lead.firstName} ${lead.lastName}`.trim() || "New Lead",
          contactId: contact.id,
          stageId: stage.id,
          ownerId: assigneeId,
          bookingStage: "INQUIRY",
        },
      })
      dealId = deal.id
    }

    // 6. Activity — inbound lead on the timeline
    await db.activity.create({
      data: {
        workspaceId,
        type: "NOTE",
        contactId: contact.id,
        dealId: dealId ?? null,
        body: `Lead captured from ${lead.source} (score ${score})`,
        source: "system",
        channel: "LEAD",
        direction: "IN",
        createdBy: "system",
      },
    })

    // 7. Consent audit trail (DPDP)
    await db.auditLog.create({
      data: { workspaceId, actorId: null, action: "LEAD_INGESTED", entity: "Contact", entityId: contact.id, meta: { source: lead.source, score } },
    })

    // 8. Mark event processed
    await db.webhookEvent.update({ where: { dedupeKey: lead.dedupeKey }, data: { status: "DONE", processedAt: new Date(), workspaceId } })

    return { deduped: false, contactId: contact.id, dealId, score }
  } catch (err) {
    await db.webhookEvent.update({
      where: { dedupeKey: lead.dedupeKey },
      data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
    }).catch(() => {})
    throw err
  }
}
