/**
 * 3-Pass Hallucination Check v2
 * Pass 1: extract assertions (numbers, dates, entities, quoted spans).
 * Pass 2: ground each via exact substring OR token-F1 >= 0.6 (handles OCR/paraphrase).
 * Pass 3: numbers/dates require exact match (no fuzzy) — policy figures must be verbatim.
 */

const THRESHOLD = Number(process.env.RAG_FAITHFULNESS_MIN || 0.8);

const STOPWORDS = new Set(["Source", "Context", "Question", "Answer", "The", "This", "It"]);

const extractAssertions = (input: string): string[] => {
  const answer = String(input).replace(/\[Source[^\]]*\]/gi, " ");
  const claims = new Set<string>();
  const nums = answer.match(/\b\d[\d,.%]*\b/g) || [];
  const dates = answer.match(/\b(?:\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/g) || [];
  const quoted = [...answer.matchAll(/"([^"]{3,120})"/g)].map((m) => m[1]);
  const entities = answer.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/g) || [];
  for (const x of [...nums, ...dates, ...quoted, ...entities]) {
    const v = x.trim();
    if (v.length > 1 && !STOPWORDS.has(v)) claims.add(v);
  }
  return [...claims];
};

const toks = (s: string): string[] => String(s).toLowerCase().split(/\W+/).filter((w) => w.length > 2);

const tokenF1 = (a: string, ctxTokens: Set<string>): number => {
  const at = toks(a);
  if (!at.length) return 1;
  const hit = at.filter((t) => ctxTokens.has(t)).length;
  return hit / at.length; // recall-oriented: claim tokens covered by context
};

const isGrounded = (assertion: string, contextLower: string, ctxTokens: Set<string>): boolean => {
  if (contextLower.includes(assertion.toLowerCase())) return true;
  if (/^\d[\d,.%]*$/.test(assertion)) return false; // numbers need verbatim
  return tokenF1(assertion, ctxTokens) >= 0.6;
};

export interface FaithfulnessResult {
  faithfulness: number;
  flagged: string[];
  passed: boolean;
  checked: number;
}

/**
 * checkFaithfulness(answer, chunks) -> { faithfulness, flagged[], passed }
 */
export const checkFaithfulness = (answer: string, chunks: Array<{ content: string; parentContext?: string }>): FaithfulnessResult => {
  const context = chunks
    .map((c) => c.content + (c.parentContext ? `\n${c.parentContext}` : ""))
    .join("\n")
    .toLowerCase();
  const ctxTokens = new Set(toks(context));
  const assertions = extractAssertions(answer || "");
  if (!assertions.length) return { faithfulness: 1, flagged: [], passed: true, checked: 0 };

  const flagged = assertions.filter((a) => !isGrounded(a, context, ctxTokens));
  const faithfulness = (assertions.length - flagged.length) / assertions.length;
  return {
    faithfulness: Number(faithfulness.toFixed(3)),
    flagged,
    passed: faithfulness >= THRESHOLD,
    checked: assertions.length,
  };
};