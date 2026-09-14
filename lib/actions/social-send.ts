"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleAction, type Result } from "@/lib/actions"
import { AppError } from "@/lib/errors"
import { requireWorkspaceMember } from "@/lib/permissions"
import { getProvider } from "@/modules/social/provider"
import { decryptAccessToken, getConnection } from "@/modules/social/connections"
import { revalidatePath } from "next/cache"

/**
 * Send an outbound message via a connected social provider.
 * Currently supports X (DM) and LinkedIn (message via Unipile).
 * Falls back to logging the message on the timeline if the provider API
 * is not configured or the feature is not yet enabled for that provider.
 */
export async function sendSocialMessage(input: {
  workspaceId: string
  contactId: string
  provider: "x" | "linkedin" | "whatsapp"
  body: string
}): Promise<Result<{ ok: true; messageId: string; sent: boolean }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(input.workspaceId, session.user.id)

    if (!input.body?.trim()) throw new AppError("VALIDATION", "Message body is required.", 400)

    const contact = await db.contact.findFirst({
      where: { id: input.contactId, workspaceId: input.workspaceId },
      select: { id: true, firstName: true, lastName: true, handles: true, phone: true },
    })
    if (!contact) throw new AppError("NOT_FOUND", "Contact not found.", 404)

    // Find the active social connection for this provider in this workspace
    const conn = await db.socialConnection.findFirst({
      where: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        status: "active",
      },
      orderBy: { createdAt: "desc" },
    })

    let sent = false
    let messageId = `social_out_${Date.now()}`

    if (conn) {
      try {
        const provider = getProvider(input.provider)
        const accessToken = decryptAccessToken(conn.accessTokenEnc)

        // Try to send via the provider's API
        if (input.provider === "whatsapp" && contact.phone) {
          // Use the WhatsApp module adapter for actual sending
          const { sendWhatsApp } = await import("@/modules/whatsapp/adapter")
          const res = await sendWhatsApp({ to: contact.phone, body: input.body })
          sent = true
          messageId = res.id
        } else if (input.provider === "x") {
          // X DM API — requires dm.write scope; send to the contact's handle
          const handle = (contact.handles as Record<string, unknown>)?.["x"] as string | undefined
            ?? (contact.handles as Record<string, unknown>)?.["twitter"] as string | undefined
          if (handle) {
            await provider.sendDm?.({
              accessToken,
              to: handle,
              body: input.body,
            })
            sent = true
          }
        } else if (input.provider === "linkedin") {
          // LinkedIn via Unipile — send message to the connected profile
          const liHandle = (contact.handles as Record<string, unknown>)?.["linkedin"] as string | undefined
          if (liHandle) {
            await provider.sendMessage?.({
              accessToken,
              to: liHandle,
              body: input.body,
            })
            sent = true
          }
        }
      } catch (err) {
        // Log but don't fail — the activity still gets recorded
        console.error(`[send-social:${input.provider}] send failed`, err)
      }
    }

    // Always record the outbound activity on the contact timeline
    await db.activity.create({
      data: {
        workspaceId: input.workspaceId,
        type: "NOTE",
        contactId: input.contactId,
        body: input.body.trim(),
        source: "social",
        channel: input.provider.toUpperCase(),
        direction: "OUT",
        createdBy: session.user.id,
      },
    })

    revalidatePath(`/${input.workspaceId}/inbox`)
    revalidatePath(`/${input.workspaceId}/contacts/${input.contactId}`)

    return { ok: true, messageId, sent }
  })
}
