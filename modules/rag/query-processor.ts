/**
 * Query Processor — Intent Classification, Decomposition, Expansion
 */

import { generate } from "./providers/llm";

const INTENT_PROMPT = `Classify the user query into ONE intent:
- factual: "What is the refund policy?"
- procedural: "How do I submit a refund request?"
- comparative: "Compare refund policies between HR and Finance"
- creative: "Write a summary of the refund policy"
- ambiguous: "Refund policy?" (needs clarification)

Return ONLY the intent label.`;

const DECOMPOSE_PROMPT = `Break this complex query into 2-4 simple sub-questions.
Each sub-question should be independently answerable.
Focus on: different entities, time periods, conditions, or perspectives.

Query: "{query}"
Intent: {intent}

Return JSON array of sub-questions only.`;

const EXPANSION_PROMPT = `Generate 3-5 alternative phrasings or synonyms for this query to improve retrieval.
Keep the same intent. Return JSON array only.

Query: "{query}"`;

export async function classifyIntent(query: string): Promise<string> {
  try {
    const result = await generate({
      system: INTENT_PROMPT,
      user: query,
      maxTokens: 10,
      temperature: 0,
    });

    const intent = (result as any).text.trim().toLowerCase();
    const validIntents = ["factual", "procedural", "comparative", "creative", "ambiguous"];
    return validIntents.includes(intent) ? intent : "factual";
  } catch {
    return "factual";
  }
}

export async function decomposeQuery(query: string, intent: string): Promise<string[]> {
  if (intent === "factual" || intent === "procedural" || intent === "ambiguous") {
    return [query];
  }

  try {
    const result = await generate({
      system: DECOMPOSE_PROMPT,
      user: `Query: "${query}"\nIntent: ${intent}`,
      maxTokens: 200,
      temperature: 0.3,
    });

    const subQuestions = JSON.parse((result as any).text);
    return Array.isArray(subQuestions)
      ? subQuestions.filter((q) => q && typeof q === "string" && q.length > 10)
      : [query];
  } catch {
    return [query];
  }
}

export async function expandQuery(query: string): Promise<string[]> {
  try {
    const result = await generate({
      system: EXPANSION_PROMPT,
      user: `Query: "${query}"`,
      maxTokens: 150,
      temperature: 0.5,
    });

    const expansions = JSON.parse((result as any).text);
    return Array.isArray(expansions) ? expansions.filter((e) => e && typeof e === "string") : [];
  } catch {
    return [];
  }
}

export interface ProcessedQuery {
  originalQuery: string;
  intent: string;
  subQueries: string[];
  needsAggregation: boolean;
  expansions: string[];
}

export async function processQuery(query: string, options: { expand?: boolean } = {}): Promise<ProcessedQuery> {
  const intent = await classifyIntent(query);
  const subQueries = await decomposeQuery(query, intent);
  const expansions = options.expand ? await expandQuery(query) : [];

  return {
    originalQuery: query,
    intent,
    subQueries: [...new Set([...subQueries, ...expansions])],
    needsAggregation: subQueries.length > 1,
    expansions,
  };
}

export function getIntentDescription(intent: string): string {
  const descriptions: Record<string, string> = {
    factual: "Direct fact lookup - single document or section",
    procedural: "Step-by-step process or how-to",
    comparative: "Compare across multiple sources/conditions",
    creative: "Generate content based on knowledge base",
    ambiguous: "Unclear intent - needs clarification or broad retrieval",
  };
  return descriptions[intent] || "Unknown intent";
}