/**
 * The three completeness bands. Named after the severity they represent rather
 * than the colour they used to hardcode, so a call site reads as intent.
 */
export type CompletenessTone = "red" | "yellow" | "green"

export type ContactCompleteness = {
  score: number
  color: CompletenessTone
  missing: string[]
}

export type DealCompleteness = {
  score: number
  color: CompletenessTone
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

export function completenessColor(score: number): CompletenessTone {
  if (score < 40) return "red"
  if (score < 70) return "yellow"
  return "green"
}

/**
 * Completeness → status token.
 *
 * These used to return raw palette classes (`bg-red-500`, `text-amber-600
 * dark:text-amber-400`). That bought nothing: the token layer already
 * defines critical / caution / positive pairs that are warm-neutral rather
 * than saturated, so the hand-rolled colors were both off-system *and*
 * louder than the surfaces around them. Every mode now comes from one
 * token, so a theme change re-tints the whole completeness language at once
 * and a new severity is a one-line addition instead of a search across
 * call sites.
 */
export function completenessBarColor(color: CompletenessTone): string {
  switch (color) {
    case "red":
      return "bg-status-critical-fg"
    case "yellow":
      return "bg-status-caution-fg"
    case "green":
      return "bg-status-positive-fg"
  }
}

export function completenessTextColor(color: CompletenessTone): string {
  switch (color) {
    case "red":
      return "text-status-critical-fg"
    case "yellow":
      return "text-status-caution-fg"
    case "green":
      return "text-status-positive-fg"
  }
}

/** Fill for a completeness bar, on the same token as the text beside it. */
export function completenessTrackColor(color: CompletenessTone): string {
  switch (color) {
    case "red":
      return "bg-status-critical-bg"
    case "yellow":
      return "bg-status-caution-bg"
    case "green":
      return "bg-status-positive-bg"
  }
}
