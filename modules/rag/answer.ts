/**
 * Answer Service — Agentic Loop with Query Enhancement + Semantic Cache
 * Orchestrates: retrieve -> confidence gate -> retry -> generate -> faithfulness -> cache
 */

import { retrieve, loadDocumentTitles } from "./retrieve";
import { scoreChunks, REFUSAL } from "./confidence";
import { checkFaithfulness } from "./faithfulness";
import { generate } from "./providers/llm";
import { cacheKey, getCached, setCached, trackCacheEntry } from "./cache";
import { semanticCache } from "./semantic-cache";
import { processQuery } from "./query-processor";
import { QueryEnhancer } from "./query-enhancer";
import { recordUsage } from "@/lib/usage";
import { extractClauseHint } from "./chunk";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

const MAX_ATTEMPTS = 3;

const enforceScope = (filter: Record<string, unknown> = {}, role: string | null = null) => {
  const departments = [...(filter.departments as string[] || [])];
  return { ...filter, departments: departments.length ? departments : filter.departments };
};

const routeIntent = (query = "", context = ""): string => {
  const q = `${query} ${context}`.toLowerCase();
  if (/(leave|payroll|policy|pf|gratuity|posh|appraisal|clause|section|compliance|contract)\b/.test(q)) return "policy";
  if (/(campaign|brand|launch|tagline|slogan|ad)\b/.test(q)) return "creative";
  return "general";
};

const rewriteQuery = async (query: string, context: string | null): Promise<string> => {
  const base = String(query).replace(/^(please|kindly|can you|could you)\b\s*/i, "").trim();
  if (!context) return base;
  try {
    const result = await generate({
      system: "Rewrite the follow-up question as a standalone query using the prior context. Return only the rewritten query.",
      user: `Context: ${context.slice(0, 1000)}\nFollow-up: ${base}`,
      maxTokens: 200,
    });
    const text = (result as any).text;
    const t = String(text || "").trim().split("\n")[0];
    return t && t.length > 3 && t.length < 1000 ? t : `${base} (${context.slice(0, 200)})`;
  } catch {
    return `${base} (${String(context).slice(0, 200)})`;
  }
};

const systemFor = (scope: string) =>
  `You are a citation-backed assistant. Answer using ONLY the provided Context sections${scope ? ` (scope: ${scope})` : ""}.
Rules:
1. Every claim must be supported by the Context.
2. Cite every assertion with [Source N] where N is the section number.
3. If the Context lacks the answer, respond with exactly: "${REFUSAL}"
4. Do NOT use outside/training knowledge to fill gaps.
5. Do NOT speculate or infer beyond what the Context explicitly states.
6. If a claim needs a specific clause (e.g. 4.2), cite the chunk whose clause_id matches.
Answer in the same language as the question.`;

const buildContext = (chunks: Array<{ content: string; documentId: string; metadata: Record<string, unknown> }>, docMeta: Record<string, unknown>) =>
  chunks
    .map((c, i) => {
      const doc = (docMeta[c.documentId] as Record<string, unknown> | undefined) || {};
      const src = (doc.title as string) || (doc.source_file as string) || c.documentId;
      const dept = doc.department ? ` Dept:${doc.department}` : "";
      const sec = (c.metadata as any)?.section_path?.length
        ? ` > ${((c.metadata as any).section_path as string[]).join(" > ")}`
        : c.metadata?.heading
          ? ` > ${c.metadata.heading}`
          : "";
      const clause = c.metadata?.clause_id ? ` (Clause ${c.metadata.clause_id})` : "";
      const loc = c.metadata?.page ? `, Page ${c.metadata.page}` : "";
      const parent = (c as any).parentContext ? `\n[Parent context]\n${(c as any).parentContext}` : "";
      return `[Source ${i + 1}: ${src}${dept}${sec}${clause}${loc}]\n${c.content}${parent}`;
    })
    .join("\n---\n");

const planAttempts = ({ query, topK, alpha, filter, intent }: { query: string; topK: number; alpha: number | undefined; filter: Record<string, unknown>; intent: string }) => {
  const clause = (filter.clause as string) || extractClauseHint(query);
  let baseAlpha = alpha ?? Number(process.env.RAG_ALPHA || 0.5);
  if (alpha === undefined || alpha === null) {
    if (intent === "policy") baseAlpha = Math.min(baseAlpha, 0.35);
    if (intent === "creative") baseAlpha = Math.max(baseAlpha, 0.6);
  }
  return [
    { topK, alpha: baseAlpha, clause, note: `hybrid:${intent}` },
    { topK: Math.min(50, topK * 2), alpha: clause ? Math.max(0, baseAlpha - 0.3) : baseAlpha, clause, note: "expand+keyword" },
    { topK: Math.min(50, topK * 2), alpha: 0.2, clause, note: "keyword-heavy clause hunt" },
  ].slice(0, MAX_ATTEMPTS);
};

const logQuery = async ({
  tenantId,
  userId,
  query,
  filter,
  result,
  latencyMs,
  providerUsed,
}: {
  tenantId: string;
  userId: string;
  query: string;
  filter: Record<string, unknown>;
  result: Record<string, unknown>;
  latencyMs: number;
  providerUsed?: string;
}) => {
  try {
    await db.ragQueryLog.create({
      data: {
        tenantId,
        query: String(query).slice(0, 2000),
        departments: filter.departments as string[] || [],
        scope: (result.scope as string) || null,
        topK: (filter.topK as number) ?? null,
        confidence: (result.confidence as Record<string, unknown>)?.topConfidence as number ?? null,
        faithfulness: result.faithfulness as number ?? null,
        refused: !!result.refused,
        attempts: (result.attempts as number) || 1,
        latencyMs,
        provider: providerUsed || null,
        createdBy: userId,
      },
    });
  } catch {
    /* audit is best-effort */
  }
};

interface AnswerQueryOptions {
  tenantId: string;
  userId: string;
  query: string;
  topK?: number;
  alpha?: number;
  filter?: Record<string, unknown>;
  role?: string | null;
  context?: string | null;
}

export const answerQuery = async ({
  tenantId,
  userId,
  query,
  topK = 8,
  alpha,
  filter = {},
  role = null,
  context = null,
}: AnswerQueryOptions) => {
  const scopedFilter = enforceScope(filter, role);
  const intent = routeIntent(query, context || "");
  const effectiveQuery = await rewriteQuery(query, context);

  let enhancedQuery = effectiveQuery;
  let enhancedAlpha = alpha;
  try {
    const enhancement = await QueryEnhancer.enhance(effectiveQuery, { tenantContext: context ?? undefined });
    enhancedQuery = enhancement.queries[0];
    enhancedAlpha = enhancement.alpha;
    console.debug("[rag] Query enhanced", {
      tenantId,
      original: query.slice(0, 50),
      enhanced: enhancedQuery.slice(0, 50),
      intent: enhancement.intent,
      alpha: enhancement.alpha,
    });
  } catch (err) {
    console.debug("[rag] Query enhancement skipped", { error: (err as Error).message });
  }

  let processedQuery = null;
  let subQueries = [enhancedQuery];
  try {
    processedQuery = await processQuery(enhancedQuery, { expand: true });
    subQueries = processedQuery.subQueries;
    console.debug("[rag] Query processed", {
      tenantId,
      intent: processedQuery.intent,
      subQueries: subQueries.length,
      needsAggregation: processedQuery.needsAggregation,
    });
  } catch (err) {
    console.debug("[rag] Query processor skipped", { error: (err as Error).message });
  }

  const scope = [
    ...(scopedFilter.departments as string[] || []),
    (scopedFilter as any).clause ? `clause ${(scopedFilter as any).clause}` : null,
    `intent:${intent}`,
  ]
    .filter(Boolean)
    .join(", ");
  const key = await cacheKey(tenantId, effectiveQuery, { topK, alpha, filter: scopedFilter, role });
  const cached = await getCached(key);
  if (cached) return { ...cached, cached: true, intent, scope };

  let semanticResult = null;
  if (semanticCache.enabled()) {
    try {
      semanticResult = await semanticCache.get(tenantId, enhancedQuery);
    } catch (err) {
      console.debug("[rag] Semantic cache read failed", { error: (err as Error).message });
    }
    if (semanticResult) {
      await recordUsage({ tenantId, userId, event: "RAG_QUERIES" });
      return { ...semanticResult, cached: true, cacheType: "semantic", intent: processedQuery?.intent || intent, scope };
    }
  }

  const t0 = Date.now();
  let allScored: Array<Record<string, unknown>> = [];
  let allDocMeta: Record<string, unknown> = {};
  let lastConf = { topConfidence: 0, threshold: 0.65, passed: false };
  let tRetrieve = 0;
  let totalAttempts = 0;

  for (const subQuery of subQueries) {
    const attempts = planAttempts({ query: subQuery, topK, alpha: enhancedAlpha, filter: scopedFilter, intent });
    totalAttempts += attempts.length;
    let subScored: Array<Record<string, unknown>> = [];

    for (let a = 0; a < attempts.length; a++) {
      const plan = attempts[a];
      const tR0 = Date.now();
      const chunks = await retrieve({
        tenantId,
        query: a === 0 ? subQuery : `${subQuery} ${plan.clause ? `section ${plan.clause}` : ""}`.trim(),
        topK: plan.topK,
        alpha: plan.alpha,
        filter: { ...scopedFilter, clause: plan.clause ?? undefined } as any,
        role,
      });
      tRetrieve += Date.now() - tR0;
      const docMeta = await loadDocumentTitles(tenantId, [...new Set(chunks.map((c) => c.documentId))]);
      const scoped = chunks.filter((c) => {
        const d = (docMeta[c.documentId] as unknown as Record<string, unknown>) || undefined;
        if (!d) return false;
        if (scopedFilter.departments && (scopedFilter.departments as string[]).length && !(scopedFilter.departments as string[]).includes(d.department as string)) return false;
        if (d.allowed_roles && (d.allowed_roles as string[]).length && role && !(d.allowed_roles as string[]).includes(role)) return false;
        return true;
      });
      const { scored, passed, topConfidence, threshold } = scoreChunks(scoped as any, docMeta as any);
      subScored = scored;
      lastConf = { topConfidence, threshold, passed };
      if (passed && scored.length) break;
      console.info("rag/agent retry", { tenantId, attempt: a + 1, note: plan.note, topConfidence });
    }

    allScored.push(...subScored);
    Object.assign(allDocMeta, await loadDocumentTitles(tenantId, [...new Set(subScored.map((c) => c.documentId as string))]));
  }

  const seen = new Set<string>();
  const deduped: Array<Record<string, unknown>> = [];
  for (const c of allScored) {
    const hash = `${c.documentId}:${c.chunk_index || 0}`;
    if (!seen.has(hash)) {
      seen.add(hash);
      deduped.push(c);
    }
  }

  const { scored, passed, topConfidence, threshold } = scoreChunks(deduped as any, allDocMeta as any);
  lastConf = { topConfidence, threshold, passed };

  if (!lastConf.passed || !scored.length) {
    const result = {
      answer: REFUSAL,
      refused: true,
      citations: [],
      chunks: [],
      confidence: { ...lastConf, passed: false },
      attempts: totalAttempts,
      scope: scope || null,
      intent: processedQuery?.intent || intent,
    };
    await recordUsage({ tenantId, userId, event: "RAG_QUERIES" });
    await logQuery({ tenantId, userId, query, filter: scopedFilter, result, latencyMs: Date.now() - t0 });
    return result;
  }

  const ctx = buildContext(
    scored.map(c => ({ content: c.content as string, documentId: c.documentId as string, metadata: c.metadata as Record<string, unknown> })),
    allDocMeta
  );
  const tGen0 = Date.now();
  const genResult = await generate({
    system: systemFor(scope),
    user: `Context:\n---\n${ctx}\n---\nQuestion: ${effectiveQuery}`,
    maxTokens: 1024,
  });
  const tGen = Date.now() - tGen0;
  const text = (genResult as any).text;
  const providerUsed = (genResult as any).providerUsed;

  const faith = checkFaithfulness(text, scored);
  const citations = scored.map((c, i) => ({
    source: i + 1,
    documentId: c.documentId,
    title: (allDocMeta[c.documentId as string] as Record<string, unknown>)?.title || (allDocMeta[c.documentId as string] as Record<string, unknown>)?.source_file,
    department: (allDocMeta[c.documentId as string] as Record<string, unknown>)?.department,
    metadata: c.metadata,
    confidence: Number((c.confidence as number).toFixed(3)),
  }));

  const evals = {
    topConfidence: Number(lastConf.topConfidence.toFixed(3)),
    faithfulness: faith.faithfulness,
    latencyMs: { retrieve: tRetrieve, generate: tGen, total: Date.now() - t0 },
    providerUsed,
  };
  console.info("rag/answer eval", { tenantId, ...evals, flagged: faith.flagged.length, scope });

  const result = {
    answer: text,
    refused: false,
    citations,
    warning: faith.passed ? null : { type: "unverified_claims", claims: faith.flagged },
    faithfulness: faith.faithfulness,
    confidence: { ...lastConf, passed: true },
    providerUsed,
    scope: scope || null,
    intent: processedQuery?.intent || intent,
    attempts: totalAttempts,
    chunks: scored.map((c) => ({ documentId: c.documentId, content: c.content, score: c.score, metadata: c.metadata })),
  };

  await recordUsage({ tenantId, userId, event: "RAG_QUERIES" });
  await logQuery({ tenantId, userId, query, filter: scopedFilter, result, latencyMs: Date.now() - t0, providerUsed });
  if (faith.passed) {
    await setCached(key, result);
    await trackCacheEntry(key, scored.map((c) => c.documentId as string));
    if (semanticCache.enabled()) {
      try {
        await semanticCache.set(tenantId, enhancedQuery, result);
      } catch (err) {
        console.debug("[rag] Semantic cache write failed", { error: (err as Error).message });
      }
    }
  }
  return result;
};