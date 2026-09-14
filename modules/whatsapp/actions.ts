"use server"

import { auth } from "@/lib/auth"
import { requireWorkspaceMember } from "@/lib/permissions"
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

  return sendOutboundWhatsAppMessage({
    workspaceId: input.workspaceId,
    workspaceSlug: membership.workspace.slug,
    userId: session.user.id,
    contactId: input.contactId,
    body: input.body,
  })
}
