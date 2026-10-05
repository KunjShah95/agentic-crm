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
import { answerLanguage, wasRewritten } from "./language";
import { db } from "@/lib/db";
import type { DocMeta, QueryFilter, ScoredChunk } from "./types";

const MAX_ATTEMPTS = 3;

/**
 * Normalise the caller's filter into the shape `retrieve` and `cacheKey` expect.
 *
 * Typed as `QueryFilter` rather than `Record<string, unknown>`. The loose type
 * is what forced a cast at each of the five places its result is read —
 * `scopedFilter.departments as string[]`, `(scopedFilter as any).clause` — and
 * the `as any` version of that last one sat inside the cache-scope string. A
 * filter key that did not exist on `QueryFilter` would have been silently spread
 * into the retrieval predicate, which is a data-scoping concern, not a typing
 * one.
 *
 * `role` is accepted and deliberately unused. It was threaded here for symmetry
 * with the SQL-level scope in `retrieve.ts`, which does apply it; keeping the
 * parameter means the signature stays honest if this ever gains the behaviour.
 */
const enforceScope = (filter: QueryFilter = {}, _role: string | null = null): QueryFilter => {
  const departments = filter.departments ? [...filter.departments] : undefined;
  return { ...filter, departments: departments?.length ? departments : filter.departments };
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
    const text = result.text;
    const t = String(text || "").trim().split("\n")[0];
    return t && t.length > 3 && t.length < 1000 ? t : `${base} (${context.slice(0, 200)})`;
  } catch {
    return `${base} (${String(context).slice(0, 200)})`;
  }
};

/**
 * @param scope      Restriction summary, so the model does not claim to have
 *                   searched departments it was not given.
 * @param language   Answer language, by name — see `./language`.
 */
const systemFor = (scope: string, language: string) =>
  `You are a citation-backed assistant. Answer using ONLY the provided Context sections${scope ? ` (scope: ${scope})` : ""}.
Rules:
1. Every claim must be supported by the Context.
2. Cite every assertion with [Source N] where N is the section number.
3. If the Context lacks the answer, respond with exactly: "${REFUSAL}"
4. Do NOT use outside/training knowledge to fill gaps.
5. Do NOT speculate or infer beyond what the Context explicitly states.
6. If a claim needs a specific clause (e.g. 4.2), cite the chunk whose clause_id matches.
7. Write the entire answer in ${language}, regardless of the language of the Context sections or the restated question. Citations stay as [Source N] either way.

The Context is in English because that is what the source documents are. You are answering a person who asked in ${language}. Use the Context as evidence; answer to them.`;

/* `ScoredChunk` rather than an inline structural literal. The literal named only
   three fields, which meant `parentContext` — read two lines below — was a type
   error, and the fix had been a cast on the read. The shared type declares the
   whole chunk, so adding a field the builder reads no longer requires editing
   this signature. */
const buildContext = (chunks: ScoredChunk[], docMeta: Record<string, DocMeta>) =>
  chunks
    .map((c, i) => {
      /* Absent metadata renders the raw document id rather than "undefined" in a
         citation. Typed as `DocMeta`, so `title`/`source_file` are `string | null`
         and the `||` chain handles all three cases without a cast. */
      const doc = docMeta[c.documentId];
      const src = doc?.title || doc?.source_file || c.documentId;
      const dept = doc?.department ? ` Dept:${doc.department}` : "";
      /* `section_path` is written by the chunker as a string array but lands in a
         free-form JSON metadata column, so `unknown` is the honest type and the
         `Array.isArray` guard is a real check, not a formality: a document that
         put a string where the array belongs used to reach `.join()` and throw
         mid-answer. `parentContext` is on `ScoredChunk` now that the shared type
         declares it, so it needs no cast. */
      const path = c.metadata?.section_path;
      const sec = Array.isArray(path) && path.length
        ? ` > ${path.map(String).join(" > ")}`
        : c.metadata?.heading
          ? ` > ${c.metadata.heading}`
          : "";
      const clause = c.metadata?.clause_id ? ` (Clause ${c.metadata.clause_id})` : "";
      const loc = c.metadata?.page ? `, Page ${c.metadata.page}` : "";
      const parent = c.parentContext ? `\n[Parent context]\n${c.parentContext}` : "";
      return `[Source ${i + 1}: ${src}${dept}${sec}${clause}${loc}]\n${c.content}${parent}`;
    })
    .join("\n---\n");

const planAttempts = ({ query, topK, alpha, filter, intent }: { query: string; topK: number; alpha: number | undefined; filter: QueryFilter; intent: string }) => {
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
  /* `QueryFilter`, not `Record<string, unknown>`. The loose type is why the two
     `logQuery` call sites below could not pass `scopedFilter` without a cast —
     and a query log whose `filter` column is untyped is a log you cannot trust
     when auditing which scope a given answer was produced under. */
  filter: QueryFilter;
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

/**
 * What every `answerQuery` caller gets, whichever path produced it.
 *
 * Declared because the function had three return statements with three different
 * inferred shapes: the fresh path builds the full object literal, while the two
 * cache hits return `{ ...cached, cached: true, intent, scope }` where `cached`
 * came from `getCached` with no type argument — so `T` inferred as `unknown`, the
 * spread contributed nothing, and TypeScript saw a union in which `citations` and
 * `answer` simply did not exist on the cached variants.
 *
 * That is not a cosmetic problem. It forced every caller reaching for
 * `result.citations` to cast, and a cast there is a cast on the *answer*, which
 * is the one value in this pipeline that must not be misread.
 *
 * The cached value genuinely does have these fields: `setCached` stores the same
 * object the fresh path returns, so the annotation describes runtime rather than
 * widening it. `warning` and `faithfulness` are optional because the refusal path
 * genuinely omits them — a refused answer has no claims to check.
 */
export interface AnswerResult {
  answer: string;
  refused: boolean;
  citations: Array<{
    source: number;
    documentId: string;
    title?: string | null;
    department?: string | null;
    metadata?: Record<string, unknown>;
    confidence: number;
  }>;
  warning?: { type: string; claims: unknown[] } | null;
  faithfulness?: number;
  confidence: { topConfidence: number; threshold: number; passed: boolean };
  providerUsed?: string;
  scope: string | null;
  intent: string;
  attempts?: number;
  chunks?: Array<{
    documentId: string;
    content: string;
    score?: number;
    metadata?: Record<string, unknown>;
  }>;
  /** Present and true only on a cache hit. */
  cached?: boolean;
  cacheType?: string;
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
}: AnswerQueryOptions): Promise<AnswerResult> => {
  const scopedFilter = enforceScope(filter, role);
  const intent = routeIntent(query, context || "");
  const effectiveQuery = await rewriteQuery(query, context);
  /* Read from `query`, before any rewrite. See `answerLanguage`. */
  const language = answerLanguage(query);

  let enhancedQuery = effectiveQuery;
  let enhancedAlpha = alpha;
  try {
    const enhancement = await QueryEnhancer.enhance(effectiveQuery, {
      tenantContext: context ?? undefined,
      /* By name, not tag — these prompts are read by a model, and "Gujarati"
         is unambiguous where "gu" would need interpreting. This is the call site
         that made the option real; it was previously declared and never passed. */
      language: language.name,
    });
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

  /* `QueryFilter` from ./types declares `departments` and `clause` — both of which
     were being cast because the local usage was checked against an inline
     literal instead. This string is the cache scope, so a department or clause
     filter that failed to reach it would serve one tenant's scoped results to
     another; the casts were hiding exactly the fields that matter most here. */
  const scope = [
    ...(scopedFilter.departments ?? []),
    scopedFilter.clause ? `clause ${scopedFilter.clause}` : null,
    `intent:${intent}`,
  ]
    .filter(Boolean)
    .join(", ");
  /* The answer language is part of the key.

     `effectiveQuery` is the English rewrite, so "રિફંડ પોલિસી કેટલા દિવસમાં?" and "What is
     the refund window?" can reduce to the same string and would have shared one
     cache entry. That was harmless while every answer was English; the moment
     answers follow the question's language it becomes a wrong-language reply
     served to the next person to ask — a Gujarati user handed an English answer
     that looks like a fresh, correctly-cited response rather than a stale one.

     Keying on the tag rather than the name keeps the key short; the name is
     derived from it in one place. */
  const key = await cacheKey(tenantId, effectiveQuery, {
    topK,
    alpha,
    filter: scopedFilter,
    role,
    lang: language.tag,
  });
  const cached = await getCached<AnswerResult>(key);
  if (cached) return { ...cached, cached: true, intent, scope };

  /* Annotated, not left to inference. `let x = null` widens to `any`, so the
     semantic hit below was spreading an `any` and returning an object TypeScript
     believed had only the four literal fields — which is how a cache hit ended up
     typed as not having an `answer` on it. */
  let semanticResult: AnswerResult | null = null;
  if (semanticCache.enabled()) {
    try {
      /* The tag is passed as `variant` rather than being folded into the query
         text: this cache matches on embedding similarity, so appending a
         language marker to the string would put a non-linguistic token into the
         vector and shift every score. See `makeCacheKey`. */
      semanticResult = await semanticCache.get<AnswerResult>(
        tenantId,
        enhancedQuery,
        role,
        language.tag
      );
    } catch (err) {
      console.debug("[rag] Semantic cache read failed", { error: (err as Error).message });
    }
    if (semanticResult) {
      await recordUsage({ tenantId, userId, event: "RAG_QUERIES" });
      return { ...semanticResult, cached: true, cacheType: "semantic", intent: processedQuery?.intent || intent, scope };
    }
  }

  const t0 = Date.now();
  const allScored: ScoredChunk[] = [];
  /* `Record<string, DocMeta>`, not `Record<string, unknown>` — this is handed
     straight to `scoreChunks`, which reads `created_at` and `authority` off each
     entry. Typed as `unknown`, every one of those reads needed a cast and a
     non-document value could have been passed in its place. */
  const allDocMeta: Record<string, DocMeta> = {};
  let lastConf = { topConfidence: 0, threshold: 0.65, passed: false };
  let tRetrieve = 0;
  let totalAttempts = 0;

  for (const subQuery of subQueries) {
    const attempts = planAttempts({ query: subQuery, topK, alpha: enhancedAlpha, filter: scopedFilter, intent });
    totalAttempts += attempts.length;
    let subScored: ScoredChunk[] = [];

    for (let a = 0; a < attempts.length; a++) {
      const plan = attempts[a];
      const tR0 = Date.now();
      const chunks = await retrieve({
        tenantId,
        query: a === 0 ? subQuery : `${subQuery} ${plan.clause ? `section ${plan.clause}` : ""}`.trim(),
        topK: plan.topK,
        alpha: plan.alpha,
        /* No cast — this object is a `QueryFilter`, which is what `retrieve` takes. The
       `as any` here was hiding that `scopedFilter` was spread into an object that
       could then carry fields `retrieve` did not declare, so a typo in a filter
       key would have been silently forwarded into the SQL predicate builder. */
        filter: { ...scopedFilter, clause: plan.clause ?? undefined },
        role,
      });
      tRetrieve += Date.now() - tR0;
      const docMeta = await loadDocumentTitles(tenantId, [...new Set(chunks.map((c) => c.documentId))]);
      const scoped = chunks.filter((c) => {
        const d = (docMeta[c.documentId] as unknown as Record<string, unknown>) || undefined;
        if (!d) return false;
        if (scopedFilter.departments && (scopedFilter.departments as string[]).length && !(scopedFilter.departments as string[]).includes(d.department as string)) return false;
        /* Same fail-closed rule as the SQL predicate in retrieve.ts, applied to
           the metadata already loaded for scoring. The old condition required
           `role` to be truthy before it would exclude anything, so a roleless
           caller waved every restricted document through this post-filter too.
           `allowed_roles` restricts only `confidential` documents, so that flag
           is part of the decision rather than the role list alone. */
        const allowed = (d.allowed_roles as string[] | undefined) ?? [];
        if (d.confidential && (!role || !allowed.includes(role))) return false;
        return true;
      });
      const { scored, passed, topConfidence, threshold } = scoreChunks(scoped, docMeta);
      subScored = scored;
      lastConf = { topConfidence, threshold, passed };
      if (passed && scored.length) break;
      console.info("rag/agent retry", { tenantId, attempt: a + 1, note: plan.note, topConfidence });
    }

    allScored.push(...subScored);
    Object.assign(allDocMeta, await loadDocumentTitles(tenantId, [...new Set(subScored.map((c) => c.documentId))]));
  }

  const seen = new Set<string>();
  /* `ScoredChunk[]`, not `Record<string, unknown>[]`. The looser type is what
     `scoreChunks` had to be cast *away* from at the call below, because a
     `Record` is not assignable to `ScoredChunk` — the cast was undoing this
     declaration, not working around anything dynamic.

     `chunk_index` is read through the index signature rather than assumed: it is
     set by the chunker, so it is present on most rows and absent on any path
     that synthesised a chunk, and `?? 0` keeps those deduping on document alone
     instead of producing `undefined` in the key. */
  const deduped: ScoredChunk[] = [];
  for (const c of allScored) {
    const hash = `${c.documentId}:${c.chunk_index ?? 0}`;
    if (!seen.has(hash)) {
      seen.add(hash);
      deduped.push(c);
    }
  }

  const { scored, passed, topConfidence, threshold } = scoreChunks(deduped, allDocMeta);
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
    system: systemFor(scope, language.name),
    /* Both questions are given, and they are not the same string.

       `effectiveQuery` is the resolved question — follow-up references ("what
       about that one?") are expanded against the prior turn, which is why it
       exists and why it stays the thing to answer. But it is an English rewrite,
       so it is not the language the user spoke and it is not how they phrased
       the question.

       Handing the model the original alongside it is what lets it answer the
       person rather than the paraphrase: register and terminology follow the
       user's wording, and rule 7's language instruction has something real to
       work from. `query` is included only when the rewrite actually changed it,
       so the common case stays as compact as it was. */
    user: `Context:\n---\n${ctx}\n---\nQuestion: ${effectiveQuery}${wasRewritten(query, effectiveQuery) ? `\n\nThe user's own words: "${query.trim()}"` : ""}`,
    maxTokens: 1024,
  });
  const tGen = Date.now() - tGen0;
  const text = genResult.text;
  const providerUsed = genResult.providerUsed;

  const faith = checkFaithfulness(text, scored);
  /* No casts. `allDocMeta` is `Record<string, DocMeta>` and `c.documentId` is a
     `string`, so every one of those five `as` casts was narrowing a value that
     was already the right type — and `c.confidence as number` would have thrown
     on `undefined` had a chunk ever reached this without being scored.

     The `?? 0` on confidence is the real behaviour: an unscored chunk has no
     confidence, and `Number(undefined.toFixed(3))` is a TypeError, so the old
     cast was protecting a path that would have crashed rather than producing a
     number. */
  const citations = scored.map((c, i) => {
    const doc = allDocMeta[c.documentId];
    return {
      source: i + 1,
      documentId: c.documentId,
      title: doc?.title || doc?.source_file,
      department: doc?.department,
      metadata: c.metadata,
      confidence: Number((c.confidence ?? 0).toFixed(3)),
    };
  });

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
        await semanticCache.set(tenantId, enhancedQuery, result, {}, role, language.tag);
      } catch (err) {
        console.debug("[rag] Semantic cache write failed", { error: (err as Error).message });
      }
    }
  }
  return result;
};