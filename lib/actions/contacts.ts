"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleAction, type Result } from "@/lib/actions"
import { AppError } from "@/lib/errors"
import { canManageData, requireWorkspaceMember } from "@/lib/permissions"
import {
  bulkAssignSchema,
  bulkTagSchema,
  contactSchema,
} from "@/lib/validators"
import { listContacts, type ContactFilters } from "@/modules/contacts/queries"
import { requireQuota } from "@/modules/billing/quota"
import { headers } from "next/headers"
import { sendEmail } from "@/modules/email/adapter"
import { checkContactFormRateLimit, getClientIp, RateLimitedError } from "@/modules/web-contact/rate-limit"
import { SITE } from "@/components/landing/site-config"

function clean(input: Record<string, unknown>) {
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    data[key] = typeof value === "string" && value.trim() === "" ? null : value
  }
  return data
}

export async function createContactAction(
  workspaceId: string,
  input: unknown
): Promise<Result<{ id: string }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const parsed = contactSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the form.")
    }
    const data = clean(parsed.data as unknown as Record<string, unknown>)
    await requireQuota(workspaceId, "contacts")
    const contact = await db.contact.create({
      data: {
        workspaceId,
        firstName: data.firstName as string,
        lastName: (data.lastName as string) ?? "",
        email: data.email as string | null,
        phone: data.phone as string | null,
        linkedinUrl: data.linkedinUrl as string | null,
        jobTitle: data.jobTitle as string | null,
        organizationId: data.organizationId as string | null,
        ownerId: session.user.id,
        createdBy: session.user.id,
      },
    })
    return { id: contact.id }
  })
}

export async function updateContactAction(
  workspaceId: string,
  contactId: string,
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const parsed = contactSchema.safeParse(input)
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Check the form.")
    }
    const data = clean(parsed.data as unknown as Record<string, unknown>)

    const exists = await db.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { id: true },
    })
    if (!exists) throw new AppError("NOT_FOUND", "Contact not found.", 404)

    await db.contact.update({
      where: { id: contactId },
      data: {
        firstName: data.firstName as string,
        lastName: (data.lastName as string) ?? "",
        email: data.email as string | null,
        phone: data.phone as string | null,
        linkedinUrl: data.linkedinUrl as string | null,
        jobTitle: data.jobTitle as string | null,
        organizationId: data.organizationId as string | null,
      },
    })
    return { ok: true }
  })
}

export async function setContactOwnerAction(
  workspaceId: string,
  contactId: string,
  ownerId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const exists = await db.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { id: true },
    })
    if (!exists) throw new AppError("NOT_FOUND", "Contact not found.", 404)

    await db.contact.update({ where: { id: contactId }, data: { ownerId: ownerId || null } })
    return { ok: true }
  })
}

export async function deleteContactAction(
  workspaceId: string,
  contactId: string
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    const membership = await requireWorkspaceMember(workspaceId, session.user.id)
    if (!canManageData(membership.role)) {
      throw new AppError("FORBIDDEN", "Admins and owners can delete contacts.", 403)
    }

    const exists = await db.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { id: true },
    })
    if (!exists) throw new AppError("NOT_FOUND", "Contact not found.", 404)

    await db.contact.delete({ where: { id: contactId } })
    return { ok: true }
  })
}

export async function bulkTagContactsAction(
  workspaceId: string,
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const parsed = bulkTagSchema.safeParse(input)
    if (!parsed.success) throw new AppError("VALIDATION", "Select contacts and tags.")

    await db.contactTag.createMany({
      data: parsed.data.contactIds.flatMap((contactId) =>
        parsed.data.tagIds.map((tagId) => ({ contactId, tagId }))
      ),
      skipDuplicates: true,
    })
    return { ok: true }
  })
}

export async function bulkAssignContactsAction(
  workspaceId: string,
  input: unknown
): Promise<Result<{ ok: true }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const parsed = bulkAssignSchema.safeParse(input)
    if (!parsed.success) throw new AppError("VALIDATION", "Select contacts and an owner.")

    await db.contact.updateMany({
      where: { id: { in: parsed.data.contactIds }, workspaceId },
      data: { ownerId: parsed.data.ownerId },
    })
    return { ok: true }
  })
}

export async function exportContactsCsvAction(
  workspaceId: string,
  filters: ContactFilters & { ids?: string[] }
): Promise<Result<{ filename: string; content: string }>> {
  return handleAction(async () => {
    const session = await auth()
    if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "Log in first.", 401)
    await requireWorkspaceMember(workspaceId, session.user.id)

    const { items } = await listContacts(workspaceId, {
      ...filters,
      pageSize: 1000,
      page: 1,
      ids: filters.ids,
    })

    const escape = (value: string | null | undefined) => {
      let v = value ?? ""
      // CSV formula injection guard: neutralize cells starting with = + - @
      if (/^[=+\-@]/.test(v)) v = `'${v}`
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
    }
    const header = ["First Name", "Last Name", "Email", "Phone", "Job Title", "Company", "LinkedIn", "Owner ID"]
    const rows = items.map((c) =>
      [
        c.firstName,
        c.lastName,
        c.email,
        c.phone,
        c.jobTitle,
        c.organization?.name,
        c.linkedinUrl,
        c.ownerId,
      ]
        .map(escape)
        .join(",")
    )

    return {
      filename: `contacts-${new Date().toISOString().slice(0, 10)}.csv`,
      content: [header.join(","), ...rows].join("\n"),
    }
  })
}

/**
 * Public (unauthenticated) contact-form submission from the marketing site.
 * Stores the sender as a Contact in the default workspace and logs the message
 * as an inbound Activity (channel WEB, direction IN) so it shows up in the
 * workspace Inbox where the team can read and reply to it.
 */
export async function submitPublicContactAction(input: {
  name: string
  email: string
  company?: string
  phone?: string
  message: string
  /** Honeypot — must be empty; bots fill it. */
  website?: string
}): Promise<Result<{ contactId: string }>> {
  return handleAction(async () => {
    // Honeypot: pretend success without writing anything.
    if (typeof input?.website === "string" && input.website.trim() !== "") {
      return { contactId: "ignored" }
    }

    // Per-IP spam rate limit (fixed window; Upstash when configured)
    const h = await headers()
    await checkContactFormRateLimit(getClientIp(h))

    const name = typeof input?.name === "string" ? input.name.trim() : ""
    const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : ""
    const company = typeof input?.company === "string" ? input.company.trim() : ""
    const phone = typeof input?.phone === "string" ? input.phone.trim() : ""
    const message = typeof input?.message === "string" ? input.message.trim() : ""

    if (name.length < 2) throw new AppError("VALIDATION", "Please enter your full name.")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError("VALIDATION", "Enter a valid email address.")
    }
    if (message.length < 10) {
      throw new AppError("VALIDATION", "Add a short note (at least 10 characters).")
    }
    if (name.length > 120 || email.length > 254 || company.length > 160 || phone.length > 32 || message.length > 5000) {
      throw new AppError("VALIDATION", "One of the fields is too long.")
    }

    // Find default target workspace for website contact submissions
    const workspace = await db.workspace.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })

    if (!workspace) {
      throw new AppError("SERVER_ERROR", "Workspace unavailable.", 500)
    }

    const nameParts = name.split(" ")
    const firstName = nameParts[0] || name
    const lastName = nameParts.slice(1).join(" ")

    // Find or create organization if company name provided
    let organizationId: string | null = null
    if (company) {
      const existingOrg = await db.organization.findFirst({
        where: { workspaceId: workspace.id, name: { equals: company, mode: "insensitive" } },
        select: { id: true },
      })
      if (existingOrg) {
        organizationId = existingOrg.id
      } else {
        const newOrg = await db.organization.create({
          data: {
            workspaceId: workspace.id,
            name: company,
          },
        })
        organizationId = newOrg.id
      }
    }

    // Upsert contact by email or create new
    const contact = await db.contact.findFirst({
      where: { workspaceId: workspace.id, email },
    })

    const contactRow = contact
      ? await db.contact.update({
          where: { id: contact.id },
          data: {
            firstName,
            lastName,
            phone: phone || contact.phone,
            organizationId: organizationId ?? contact.organizationId,
            leadSource: contact.leadSource ?? "WEBSITE_CONTACT_FORM",
            consentAt: new Date(),
            optedOut: false,
          },
        })
      : await db.contact.create({
          data: {
            workspaceId: workspace.id,
            firstName,
            lastName,
            email,
            phone: phone || null,
            organizationId,
            leadSource: "WEBSITE_CONTACT_FORM",
            consentAt: new Date(),
            createdBy: "system",
          },
        })

    // Log inbound activity so the workspace team can read & reply to it in the CRM Inbox
    const activityBody = `Inbound Contact Form Submission:\n\nCompany/Project: ${company || "N/A"}\nPhone: ${phone || "N/A"}\nMessage:\n${message}`
    await db.activity.create({
      data: {
        workspaceId: workspace.id,
        contactId: contactRow.id,
        type: "NOTE",
        body: activityBody,
        source: "WEBSITE_CONTACT_FORM",
        channel: "WEB",
        direction: "IN",
        createdBy: "system",
      },
    })

    // Notify the team (best-effort — never fails the submission)
    try {
      await sendEmail({
        to: SITE.contact.email,
        subject: `New website enquiry — ${name}${company ? ` (${company})` : ""}`,
        body: `
          <p><strong>${name}</strong> sent a message via the contact form.</p>
          <ul>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Phone:</strong> ${phone || "—"}</li>
            <li><strong>Company/Project:</strong> ${company || "—"}</li>
          </ul>
          <p>${message.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!))}</p>
          <p><em>Reply from the CRM Inbox: this message is stored on the contact's timeline.</em></p>
        `,
      })
    } catch (err) {
      console.error("[web-contact] team notification failed", err)
    }

    return { contactId: contactRow.id }
  })
}
