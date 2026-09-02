/**
 * AI drafting — template + LLM stub.
 * When OPENAI_API_KEY / ANTHROPIC not set, returns deterministic template.
 * Reuses shortcodes shape; caller substitutes {{rera_no}} etc via documents/shortcodes.
 */

export type DraftIntent = "lead_ack" | "cost_sheet" | "visit_reminder" | "demand_letter" | "nudge"

export function draftMessage(opts: {
  intent: DraftIntent
  contactName?: string
  projectName?: string
  unitNo?: string
  amount?: number
  channel?: "WHATSAPP" | "EMAIL"
}): string {
  const name = opts.contactName ?? "there"
  const project = opts.projectName ?? "your project"
  const unit = opts.unitNo ? `Unit ${opts.unitNo}` : "your unit"
  const amt = opts.amount ? `₹${opts.amount.toLocaleString("en-IN")}` : ""

  switch (opts.intent) {
    case "lead_ack":
      return `Hi ${name}, thanks for enquiring about ${project}. Our team will call within 4 hours. Reply YES to get the cost sheet on WhatsApp.`
    case "cost_sheet":
      return `Hi ${name}, here’s the cost sheet for ${unit} at ${project}${amt ? ` — total ${amt}` : ""}. Let me know a convenient time for a site visit.`
    case "visit_reminder":
      return `Hi ${name}, reminder: site visit for ${project} ${unit} is tomorrow. Share live location if you need pickup. See you at 11 AM!`
    case "demand_letter":
      return `Dear ${name}, demand for ${unit} at ${project}${amt ? ` — ${amt} due by next week` : ""}. Pay via the link or contact us for assistance.`
    case "nudge":
      return `Hi ${name}, still interested in ${project}? Prices revise next month — want me to hold ${unit} for 48h?`
    default:
      return `Hi ${name}, following up on ${project}.`
  }
}

// LLM-swappable stub — if OPENAI key present, this would call the API; mock now.
export async function draftMessageLLM(opts: Parameters<typeof draftMessage>[0]): Promise<string> {
  if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
    // placeholder for real LLM call — keep deterministic for tests
    return draftMessage(opts) + " — (LLM)"
  }
  return draftMessage(opts)
}
