export type ContactCompleteness = {
  score: number
  color: "red" | "yellow" | "green"
  missing: string[]
}

export type DealCompleteness = {
  score: number
  color: "red" | "yellow" | "green"
  missing: string[]
}

export function contactCompleteness(contact: {
  firstName?: string | null
  email?: string | null
  phone?: string | null
  organizationId?: string | null
  jobTitle?: string | null
  ownerId?: string | null
  leadSource?: string | null
  tags?: unknown[]
}): ContactCompleteness {
  const missing: string[] = []
  let score = 0

  if (contact.firstName && contact.firstName.trim()) score += 10
  else missing.push("First name")

  if (contact.email && contact.email.trim()) score += 20
  else missing.push("Email")

  if (contact.phone && contact.phone.trim()) score += 20
  else missing.push("Phone")

  if (contact.organizationId) score += 15
  else missing.push("Company")

  if (contact.jobTitle && contact.jobTitle.trim()) score += 10
  else missing.push("Job title")

  if (contact.ownerId) score += 10
  else missing.push("Owner")

  if (contact.leadSource && contact.leadSource.trim()) score += 10
  else missing.push("Lead source")

  if (contact.tags && contact.tags.length > 0) score += 5
  else missing.push("Tags")

  return { score, color: completenessColor(score), missing }
}

export function dealCompleteness(deal: {
  title?: string | null
  contactId?: string | null
  value?: number | null
  stageId?: string | null
  ownerId?: string | null
  expectedCloseDate?: Date | string | null
  dealType?: string | null
  probability?: number | null
}): DealCompleteness {
  const missing: string[] = []
  let score = 0

  if (deal.title && deal.title.trim()) score += 10
  else missing.push("Title")

  if (deal.contactId) score += 20
  else missing.push("Contact")

  if (deal.value && deal.value > 0) score += 20
  else missing.push("Value")

  if (deal.stageId) score += 10
  else missing.push("Stage")

  if (deal.ownerId) score += 10
  else missing.push("Owner")

  if (deal.expectedCloseDate) score += 10
  else missing.push("Close date")

  if (deal.dealType && deal.dealType.trim()) score += 10
  else missing.push("Deal type")

  if (deal.probability != null && deal.probability >= 0) score += 10
  else missing.push("Win probability")

  return { score, color: completenessColor(score), missing }
}

export function completenessColor(score: number): "red" | "yellow" | "green" {
  if (score < 40) return "red"
  if (score < 70) return "yellow"
  return "green"
}

export function completenessBarColor(color: "red" | "yellow" | "green"): string {
  switch (color) {
    case "red":
      return "bg-red-500"
    case "yellow":
      return "bg-amber-500"
    case "green":
      return "bg-emerald-500"
  }
}

export function completenessTextColor(color: "red" | "yellow" | "green"): string {
  switch (color) {
    case "red":
      return "text-red-600 dark:text-red-400"
    case "yellow":
      return "text-amber-600 dark:text-amber-400"
    case "green":
      return "text-emerald-600 dark:text-emerald-400"
  }
}
