"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  brokerContactScope,
  requireWorkspaceMember,
  resolveViewerScope,
} from "@/lib/permissions"
import { sendOutboundWhatsAppMessage, type OutboundResult } from "@/modules/comms/outbox"

/**
 * Server-action surface for outbound WhatsApp.
 *
 * The inbound half used to live here as `recordInboundWhatsApp`, which wrote
 * timeline rows on a second, unverified path that silently dropped messages from
 * unknown numbers. It is gone — inbound is /api/whatsapp/webhook plus
 * modules/social/ingest, so there is one rail and it never discards a message.
 */
export async function sendWhatsAppMessage(input: {
  workspaceId: string
  contactId: string
  body: string
}): Promise<OutboundResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, code: "PROVIDER_ERROR", message: "Log in first." }
  }
  // The membership check doubles as the slug lookup: revalidatePath keys on the
  // slug, and the old code passed the workspace cuid and silently never refreshed.
  const membership = await requireWorkspaceMember(input.workspaceId, session.user.id).catch(() => null)
  if (!membership) {
    return { ok: false, code: "PROVIDER_ERROR", message: "You don't have access to this workspace." }
  }

  // Outbound broker scoping.
  //
  // Every *read* of the inbox is broker-scoped, but this action was not, and it
  // does not need the UI to be reachable: a server action is a public endpoint on
  // the app. Passing any `contactId` in the tenant let a BROKER send a WhatsApp
  // message to another broker's client — from the company's own business number,
  // to a real customer's phone, with no UI involved. `production-readiness.md`
  // already flags unsolicited outbound as a WhatsApp-policy ban risk on the
  // customer's account, which makes this more than a data leak.
  //
  // The failure is reported as CONTACT_NOT_FOUND rather than a permission error
  // on purpose: a distinct "forbidden" code would confirm the contact exists and
  // turn the action into an oracle for enumerating another broker's book.
  const scope = await resolveViewerScope(input.workspaceId, session.user.id)
  if (!scope) {
    return { ok: false, code: "PROVIDER_ERROR", message: "You don't have access to this workspace." }
  }
  const visible = await db.contact.findFirst({
    where: {
      id: input.contactId,
      workspaceId: input.workspaceId,
      ...brokerContactScope(scope.role, scope.brokerId),
    },
    select: { id: true },
  })
  if (!visible) {
    return { ok: false, code: "CONTACT_NOT_FOUND", message: "Contact not found." }
  }

  return sendOutboundWhatsAppMessage({
    workspaceId: input.workspaceId,
    workspaceSlug: membership.workspace.slug,
    userId: session.user.id,
    contactId: input.contactId,
    body: input.body,
  })
}
