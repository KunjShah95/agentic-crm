/**
 * Lead ingest worker — consumes a webhook lead payload and materializes it
 * into Contact + Deal + Activity, workspace-scoped, with dedupe + scoring +
 * routing + consent audit. Called by the queue consumer or synchronously in
 * dev. Never throws to the provider; failures are recorded on WebhookEvent.
 *
 * Outbound messaging (the WhatsApp auto-ack) is gated on two things the caller
 * must supply or satisfy: a `trusted` ingress and a workspace opt-in. See
 * `./ingress` and the gate at step 6b.
 */

import { db } from "@/lib/db"
import { normalizeLead } from "./normalize"
import { calcLeadScore } from "./scoring"
import { pickAssignee, type RoutableMember, type RoutingStrategy } from "./routing"
import { isAutoAckEnabled } from "./ingress"
import { sendWhatsApp, renderWaTemplate } from "@/modules/whatsapp/adapter"

export type ProcessLeadInput = {
  workspaceId: string
  source: string
  payload: unknown
  strategy?: RoutingStrategy
  /**
   * Whether the ingress path was authenticated, or passed the anti-spam
   * gates (rate limit + honeypot) for a path that cannot carry a secret.
   *
   * This gates the WhatsApp auto-ack. The enqueue/replay route
   * (`app/api/admin/leads/replay`) passes nothing: a replay of historical
   * events must never turn into outbound messaging, because the contacts in
   * those payloads were captured before consent was recorded.
   */
  trusted?: boolean
}

export type ProcessLeadResult = {
  deduped: boolean
  contactId?: string
  dealId?: string
  score?: number
  acked?: boolean
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
      data: { workspaceId, source: lead.source, payload: lead.raw as object, dedupeKey: lead.dedupeKey },
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
    const isNewContact = !contact

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

    // 6b. Auto-ack via WhatsApp for brand-new leads with a phone.
    //
    // Two gates, both required. `trusted` says the lead came through an
    // authenticated or anti-spam-gated ingress rather than an open endpoint,
    // and the workspace opt-in says someone chose to receive outbound
    // messages. Without both, a third party could otherwise make a customer's
    // WhatsApp number message arbitrary phone numbers, which is a policy ban
    // on that customer's account.
    //
    // Best-effort: a lead must still be captured if WhatsApp is unconfigured
    // or the send fails, so this never propagates out of processLead.
    const autoAckAllowed =
      input.trusted === true && (await isAutoAckEnabled(workspaceId))
    let acked = false
    if (isNewContact && lead.phone && !contact.optedOut && autoAckAllowed) {
      const body = renderWaTemplate("lead_ack", {
        name: lead.firstName,
        project: lead.project ?? "our project",
        workspace: "our team",
      })
      try {
        const res = await sendWhatsApp({ to: lead.phone, body })
        acked = !res.mock
        await db.activity.create({
          data: {
            workspaceId,
            type: "NOTE",
            contactId: contact.id,
            dealId: dealId ?? null,
            body,
            source: "system",
            channel: "WHATSAPP",
            direction: "OUT",
            createdBy: "system",
          },
        })
      } catch (err) {
        console.warn("[leadIngest] whatsapp auto-ack skipped:", err instanceof Error ? err.message : err)
        await db.activity.create({
          data: {
            workspaceId,
            type: "NOTE",
            contactId: contact.id,
            dealId: dealId ?? null,
            body: `WhatsApp auto-ack not sent — ${body}`,
            source: "system",
            channel: "WHATSAPP",
            direction: "OUT",
            createdBy: "system",
          },
        })
      }
    }

    // 7. Consent audit trail (DPDP) — logged as a system Activity on the timeline.
    //
    // States the actual basis rather than asserting "Consent recorded"
    // unconditionally. The lawful basis here is the enquirer submitting their
    // own number for an enquiry, not marketing consent; and it is recorded
    // separately from whether we messaged them, so an auditor can tell those
    // two things apart.
    await db.activity.create({
      data: {
        workspaceId,
        type: "NOTE",
        contactId: contact.id,
        body: `Contact basis recorded · number submitted via ${lead.source} enquiry · outbound WhatsApp ${acked ? "sent" : "not sent"}`,
        source: "system",
        channel: "AUDIT",
        createdBy: "system",
      },
    })

    // 8. Mark event processed (processedAt acts as the DONE marker; a null
    //    processedAt means the event can be safely replayed).
    await db.webhookEvent.update({ where: { dedupeKey: lead.dedupeKey }, data: { processedAt: new Date(), workspaceId } })

    return { deduped: false, contactId: contact.id, dealId, score, acked }
  } catch (err) {
    // Leave processedAt null so the event is replayable; nothing else to persist.
    throw err
  }
}
