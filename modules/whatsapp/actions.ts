"use server"

import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { auth } from "@/lib/auth"
import { sendWhatsApp } from "./adapter"
import { revalidatePath } from "next/cache"

async function authed(workspaceId: string) {
  const s = await auth()
  if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  return s.user.id
}

/**
 * Send an outbound WhatsApp message to a contact and log it on the timeline.
 * Respects DPDP opt-out: refuses to send if the contact has optedOut.
 */
export async function sendWhatsAppMessage(input: {
  workspaceId: string
  contactId: string
  body: string
}) {
  const userId = await authed(input.workspaceId)
  const contact = await db.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
  })
  if (!contact) throw new Error("Contact not found")
  if (contact.optedOut) throw new Error("Contact has opted out of messaging")
  if (!contact.phone) throw new Error("Contact has no phone number")

  const res = await sendWhatsApp({ to: contact.phone, body: input.body })

  await db.activity.create({
    data: {
      workspaceId: input.workspaceId,
      type: "NOTE",
      contactId: contact.id,
      body: input.body,
      source: "system",
      channel: "WHATSAPP",
      direction: "OUT",
      createdBy: userId,
    },
  })

  revalidatePath(`/${input.workspaceId}/inbox`)
  return { messageId: res.id, mock: res.mock }
}

/**
 * Record an inbound WhatsApp message (called by the Meta webhook). Matches the
 * sender phone to a contact within the workspace and appends an IN activity.
 * Returns null when no contact matches (unknown sender → ignored for now).
 */
export async function recordInboundWhatsApp(input: {
  workspaceId: string
  from: string
  body: string
}) {
  const digits = input.from.replace(/[^\d]/g, "")
  const contact = await db.contact.findFirst({
    where: {
      workspaceId: input.workspaceId,
      phone: { contains: digits.slice(-10) },
    },
  })
  if (!contact) return null

  const activity = await db.activity.create({
    data: {
      workspaceId: input.workspaceId,
      type: "NOTE",
      contactId: contact.id,
      body: input.body,
      source: "system",
      channel: "WHATSAPP",
      direction: "IN",
      createdBy: "system",
    },
  })
  return { activityId: activity.id, contactId: contact.id }
}
