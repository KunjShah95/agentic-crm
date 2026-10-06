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

// ── LLM API response types ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenAIResponse = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnthropicResponse = any

// ── draftMessageLLM ─────────────────────────────────────────────────────────

/**
 * LLM-powered message drafting. Prefers OpenAI, falls back to Anthropic,
 * and falls back to the deterministic template when no key is set or the
 * API call fails.
 */
export async function draftMessageLLM(opts: Parameters<typeof draftMessage>[0]): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  // No API keys — use the deterministic template
  if (!openaiKey && !anthropicKey) {
    return draftMessage(opts)
  }

  const prompt = buildPrompt(opts)

  try {
    if (openaiKey) {
      return await callOpenAI(openaiKey, prompt)
    }
    if (anthropicKey) {
      return await callAnthropic(anthropicKey, prompt)
    }
  } catch {
    // Fall through to template on any API error
  }

  return draftMessage(opts)
}

// ── Prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(opts: Parameters<typeof draftMessage>[0]): string {
  const parts = [
    `You are a real-estate sales assistant drafting a WhatsApp message.`,
    ``,
    `Intent: ${opts.intent}`,
    `Contact name: ${opts.contactName ?? "there"}`,
    `Project: ${opts.projectName ?? "your project"}`,
  ]
  if (opts.unitNo) parts.push(`Unit: ${opts.unitNo}`)
  if (opts.amount) parts.push(`Budget: ₹${opts.amount.toLocaleString("en-IN")}`)
  if (opts.channel) parts.push(`Channel: ${opts.channel}`)
  parts.push(``, `Write a concise, friendly message (2-3 sentences max). Return only the message text — no preamble, no quotes.`)

  return parts.join("\n")
}

// ── OpenAI ──────────────────────────────────────────────────────────────────

async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    }),
  })

  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)

  const data: OpenAIResponse = await res.json()
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error("OpenAI returned empty content")

  return text
}

// ── Anthropic ───────────────────────────────────────────────────────────────

async function callAnthropic(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`)

  const data: AnthropicResponse = await res.json()
  const text = data.content?.[0]?.text?.trim()
  if (!text) throw new Error("Anthropic returned empty content")

  return text
}
