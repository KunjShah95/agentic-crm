/**
 * Call analysis stub — regex/heuristic extractor.
 * LLM-swappable: same shape, better accuracy later.
 */

export type CallAnalysis = {
  budgetMin?: number
  budgetMax?: number
  config?: string
  possessionMonths?: number
  sentiment: "positive" | "neutral" | "negative"
  keywords: string[]
}

const CONFIG_RE = /\b(1\s*bhk|2\s*bhk|3\s*bhk|4\s*bhk|bhk\s*[1-4]|villa|plot|shop|office)\b/i
const BUDGET_RE = /(?:budget|price|range)[^\d]*(\d+(?:\.\d+)?)\s*(lakh|lac|cr|crore)?\s*(?:to|-)?\s*(\d+(?:\.\d+)?)?\s*(lakh|lac|cr|crore)?/i
const POSSESSION_RE = /(\d+)\s*(months?|years?)\b/i

function toINR(n: number, unit?: string): number {
  if (!unit) return n
  const u = unit.toLowerCase()
  if (u.startsWith("lac") || u.startsWith("lakh")) return n * 1_00_000
  if (u.startsWith("cr")) return n * 1_00_00_000
  return n
}

export function analyzeCall(transcript: string): CallAnalysis {
  const lower = transcript.toLowerCase()
  const sentiment: CallAnalysis["sentiment"] =
    /love|great|excited|happy|perfect|amazing/.test(lower) ? "positive" : /angry|upset|disappointed|refund|cancel/.test(lower) ? "negative" : "neutral"

  let config: string | undefined
  const cm = transcript.match(CONFIG_RE)
  if (cm) {
    const raw = cm[1].toLowerCase().replace(/\s+/g, "")
    if (raw.includes("1")) config = "BHK1"
    else if (raw.includes("2")) config = "BHK2"
    else if (raw.includes("3")) config = "BHK3"
    else if (raw.includes("4")) config = "BHK4"
    else config = raw.toUpperCase()
  }

  let budgetMin: number | undefined
  let budgetMax: number | undefined
  const bm = transcript.match(BUDGET_RE)
  if (bm) {
    const n1 = parseFloat(bm[1])
    const u1 = bm[2]
    const n2 = bm[3] ? parseFloat(bm[3]) : undefined
    const u2 = bm[4]
    if (!Number.isNaN(n1)) budgetMin = toINR(n1, u1)
    if (n2 !== undefined && !Number.isNaN(n2)) budgetMax = toINR(n2, n2 !== undefined ? u2 ?? u1 : undefined)
  }

  let possessionMonths: number | undefined
  const pm = transcript.match(POSSESSION_RE)
  if (pm) {
    const n = parseInt(pm[1], 10)
    const unit = pm[2].toLowerCase()
    possessionMonths = unit.startsWith("year") ? n * 12 : n
  }

  const keywords = Array.from(new Set(lower.match(/\b(budget|possession|r era|rera|payment|location|price|site visit|visit|book)\b/g) ?? []))

  return { budgetMin, budgetMax, config, possessionMonths, sentiment, keywords }
}
