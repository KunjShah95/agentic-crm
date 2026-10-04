/**
 * Query Enhancer — Improves Retrieval Quality Through Decomposition, Rewriting, and Intent Classification
 */

import { generate } from "./providers/llm";

const DECOMPOSE_SYSTEM = `You are a query decomposer for a knowledge base RAG system.
Break complex questions into simpler sub-questions that can each be answered independently.

Rules:
- Each sub-question must be self-contained and answerable from documents
- Keep sub-questions relevant to the original intent
- Max 3 sub-questions
- If the question is simple (single topic), return it unchanged
- Return as a JSON array of strings

Examples:
Q: "What's the refund policy and how do I return an item?"
→ ["What is the refund policy timeframe?", "What is the return process?"]

Q: "Compare the pricing plans and features"
→ ["What pricing plans are available?", "What features are in each plan?"]

Q: "What is the refund policy?"
→ ["What is the refund policy?"]`;

const REWRITE_SYSTEM = `You are a query rewriter for a knowledge base RAG system.
Rewrite queries to be more effective for document retrieval.

Rules:
- Expand abbreviations and acronyms
- Fix implicit references (e.g., "it" -> specific topic)
- Add context from the original query
- Keep it concise (1-2 sentences)
- Return only the rewritten query, no explanation`;

const INTENT_SYSTEM = `Classify the intent of this query for a knowledge base.
Return a JSON object with: { intent, alpha }

intents: "factual" | "policy" | "procedural" | "comparative" | "definition" | "unknown"
alpha: vector weight (0-1), keyword weight is (1-alpha)
- factual: alpha=0.7 (vector-heavy, semantic matching)
- policy: alpha=0.3 (keyword-heavy, exact terms matter)
- procedural: alpha=0.5 (balanced)
- comparative: alpha=0.5 (balanced, need both)
- definition: alpha=0.6 (slightly vector-heavy)
- unknown: alpha=0.5 (default)`;

interface EnhanceResult {
  queries: string[];
  intent: string;
  alpha: number;
  original: string;
}

interface ClassifyResult {
  intent: string;
  alpha: number;
}

export class QueryEnhancer {
  static async enhance(
    query: string,
    /* `language` is the answer language, not the retrieval language.

       The three calls below produce *retrieval* queries, and the corpus is
       English-language RERA and Gujarat regulation documents. So a Gujarati
       question is deliberately translated into English sub-queries — that is what
       makes them match the documents, and forcing them to stay in Gujarati would
       find nothing.

       What must not be lost is the user's language, because the rewritten query
       is what reaches the answering model, and that model's instruction to
       "answer in the same language as the question" was reading an English
       string. `answer.ts` now states the language explicitly and passes the
       original wording; `language` here exists so the enhancer is not the thing
       that discards it, and is threaded into the prompts so they are told which
       language the answer will be in and do not drift into rewriting the intent.

       Deriving it from the query itself, rather than trusting the caller, is
       deliberate — the only call site passes `tenantContext` alone, so an
       option the caller must remember to set is an option nobody sets. */
    options: { tenantContext?: string; language?: string } = {}
  ): Promise<EnhanceResult> {
    const { tenantContext = "", language = "" } = options;
    const answerNote = language
      ? `\nThe user asked in ${language}. Keep the meaning exactly; the answer will be written in ${language}, so do not add or drop any constraint.`
      : "";

    const [intentResult, decomposed] = await Promise.all([
      this.classifyIntent(query, tenantContext),
      this.decompose(query, tenantContext, answerNote),
    ]);

    const rewritten = await this.rewrite(decomposed[0], tenantContext, answerNote);

    return {
      queries: [rewritten, ...decomposed.slice(1)],
      intent: intentResult.intent,
      alpha: intentResult.alpha,
      original: query,
    };
  }

  static async classifyIntent(query: string, context = ""): Promise<ClassifyResult> {
    const result = await generate({
      system: INTENT_SYSTEM,
      user: context ? `${context}\n\nQuery: ${query}` : query,
      maxTokens: 100,
    });

    try {
      const parsed = JSON.parse(result.text);
      /* Bounded before it reaches `alpha`, which is used as a Prisma `topK`
         -style weight and, further down, as the vector/keyword blend. A model
         answering with `"alpha": 95` would otherwise silently dominate the hybrid
         search. The clamp is on the parse, not at the point of use, so every
         consumer gets the bounded value. */
      const raw = typeof parsed.alpha === "number" ? parsed.alpha : 0.5;
      return {
        intent: typeof parsed.intent === "string" ? parsed.intent : "unknown",
        alpha: Math.max(0, Math.min(1, raw)),
      };
    } catch {
      return { intent: "unknown", alpha: 0.5 };
    }
  }

  static async decompose(query: string, context = "", note = ""): Promise<string[]> {
    const result = await generate({
      system: DECOMPOSE_SYSTEM,
      user: `${context ? `${context}\n\n` : ""}Question: ${query}${note}`,
      maxTokens: 200,
    });

    try {
      const parsed = JSON.parse(result.text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        /* Only strings. The prompt asks for a JSON array of strings, and
           `parsed.length` alone is satisfied by an array of objects or numbers —
           which then became `query: [object Object]` in the retriever, silently
           returning nothing rather than erroring. */
        const strings = parsed.filter((q): q is string => typeof q === "string" && q.trim().length > 0);
        if (strings.length) return strings;
      }
    } catch {
      // Not JSON, try to parse line by line
    }

    return [query];
  }

  static async rewrite(query: string, context = "", note = ""): Promise<string> {
    const result = await generate({
      system: REWRITE_SYSTEM,
      user: `${context ? `${context}\n\n` : ""}Original: ${query}${note}`,
      maxTokens: 100,
    });

    return result.text.trim() || query;
  }

  static mergeResults(
    allChunks: Array<{ id?: string; chunk_index?: number; [key: string]: unknown }>,
    allScores: number[],
    topK = 15
  ): { chunks: Array<{ [key: string]: unknown }>; scores: number[] } {
    const chunkMap = new Map<string, { chunk: { [key: string]: unknown }; score: number }>();

    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      const score = allScores[i];
      const key = chunk.id || String(chunk.chunk_index);

      if (!chunkMap.has(key) || chunkMap.get(key)!.score < score) {
        chunkMap.set(key, { chunk, score });
      }
    }

    const sorted = Array.from(chunkMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return {
      chunks: sorted.map((s) => s.chunk),
      scores: sorted.map((s) => s.score),
    };
  }
}

export { DECOMPOSE_SYSTEM, REWRITE_SYSTEM, INTENT_SYSTEM };