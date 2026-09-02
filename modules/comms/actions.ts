"use server"

import { db } from "@/lib/db"
import { requireWorkspaceMember } from "@/lib/permissions"
import { auth } from "@/lib/auth"
import { sendSms } from "@/modules/sms/adapter"
import { sendEmail } from "@/modules/email/adapter"
import { revalidatePath } from "next/cache"

async function authed(workspaceId: string) {
  const s = await auth()
  if (!s?.user?.id) throw new Error("Unauthorized")
  await requireWorkspaceMember(workspaceId, s.user.id)
  return s.user.id
}

/**
 * Send an outbound SMS to a contact and log it on the timeline.
 * Respects DPDP opt-out: refuses to send if the contact has optedOut.
 */
export async function sendSmsMessage(input: {
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

  const res = await sendSms({ to: contact.phone, body: input.body })

  await db.activity.create({
    data: {
      workspaceId: input.workspaceId,
      type: "NOTE",
      contactId: contact.id,
      body: input.body,
      source: "system",
      channel: "SMS",
      direction: "OUT",
      createdBy: userId,
    },
  })

  revalidatePath(`/${input.workspaceId}/inbox`)
  return { messageId: res.id, mock: res.mock }
}

/**
 * Send an outbound email to a contact and log it on the timeline.
 * Respects DPDP opt-out: refuses to send if the contact has optedOut.
 */
export async function sendEmailMessage(input: {
  workspaceId: string
  contactId: string
  subject: string
  body: string
}) {
  const userId = await authed(input.workspaceId)
  const contact = await db.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
  })
  if (!contact) throw new Error("Contact not found")
  if (contact.optedOut) throw new Error("Contact has opted out of messaging")
  if (!contact.email) throw new Error("Contact has no email address")

  const res = await sendEmail({ to: contact.email, subject: input.subject, body: input.body })

  await db.activity.create({
    data: {
      workspaceId: input.workspaceId,
      type: "EMAIL",
      contactId: contact.id,
      body: `${input.subject}\n\n${input.body}`,
      source: "system",
      channel: "EMAIL",
      direction: "OUT",
      createdBy: userId,
    },
  })

  revalidatePath(`/${input.workspaceId}/inbox`)
  return { messageId: res.id, mock: res.mock }
}

/**
 * Click-to-call logging — records a phone call on the contact timeline.
 * The dialing happens client-side (tel: link or CTI); this just persists the
 * disposition so calls surface alongside WhatsApp/SMS/email in the timeline.
 */
export async function logCall(input: {
  workspaceId: string
  contactId: string
  direction: "IN" | "OUT"
  durationSec?: number
  notes?: string
}) {
  const userId = await authed(input.workspaceId)
  const contact = await db.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
  })
  if (!contact) throw new Error("Contact not found")

  const dur = input.durationSec ?? 0
  const mins = Math.floor(dur / 60)
  const secs = dur % 60
  const summary = `Call ${input.direction === "OUT" ? "placed" : "received"} · ${mins}m ${secs}s (${dur}s)${input.notes ? ` — ${input.notes}` : ""}`

  const activity = await db.activity.create({
    data: {
      workspaceId: input.workspaceId,
      type: "CALL",
      contactId: contact.id,
      body: summary,
      source: "system",
      channel: "CALL",
      direction: input.direction,
      createdBy: userId,
    },
  })

  revalidatePath(`/${input.workspaceId}/inbox`)
  return { activityId: activity.id }
}
