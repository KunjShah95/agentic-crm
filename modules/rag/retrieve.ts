/**
 * Retrieval Service — Hybrid Search + Rerank + Parent Context Expansion
 * Stage 1: hybrid fusion via RPC (namespace + ACL scoped).
 * Stage 2: clause boost + cross-encoder rerank.
 * Stage 3 (small-to-big): expand each hit with ±1 neighbor chunk from the same
 * document so generation sees clause + parent context while citations stay precise.
 */

import { db } from "@/lib/db";
// Prisma 7: the namespace (incl. Prisma.sql / Prisma.join) lives on the generated client.
import { Prisma } from "@/lib/generated/prisma/client";
import { embed } from "./providers/embeddings";
import { rerank } from "./providers/rerank";
import { extractClauseHint } from "./chunk";
import { generate } from "./providers/llm";
import type { DocMeta, ScoredChunk } from "./types";

const DEFAULT_ALPHA = Number(process.env.RAG_ALPHA || 0.5);
const POOL = Number(process.env.RAG_POOL || 30);

const HIERARCHICAL = process.env.RAG_HIERARCHICAL === "1";

const HYDE_ENABLED = process.env.RAG_HYDE === "1";
const TEMPORAL_DECAY_ENABLED = process.env.RAG_TEMPORAL_DECAY === "1";
const AUTHORITY_WEIGHTING_ENABLED = process.env.RAG_AUTHORITY_WEIGHTING === "1";
/* No `RAG_MULTI_VECTOR` flag. It was read here into a constant that nothing
   referenced, and the corresponding `multiVector` field on `RetrieveFilter` was
   likewise declared and never read or passed — multi-vector retrieval was
   documented in the README as an available strategy but was not implemented at
   any point. A flag that is accepted and silently ignored is worse than a
   missing one: it reads as configuration, so an operator sets it, sees no change,
   and concludes the strategy is subtly mis-tuned. Removed from the README along
   with the dead code; re-add all three together when it is actually built. */

const DEPT_ALPHA: Record<string, number> = { hr: 0.3, legal: 0.3, finance: 0.35, marketing: 0.65, engineering: 0.5, general: DEFAULT_ALPHA };
const alphaFor = (explicit: number | undefined, departments?: string[]): number => {
  if (explicit !== undefined && explicit !== null) return explicit;
  const d = departments?.[0];
  return d ? DEPT_ALPHA[d] ?? DEFAULT_ALPHA : DEFAULT_ALPHA;
};

const toVectorLiteral = (arr: number[]): string => `[${arr.join(",")}]`;

async function generateHyDE(query: string): Promise<string | null> {
  try {
    const response = await generate({
      system: `You are a helpful assistant. Given a user query, write a brief, 
        hypothetical document that would perfectly answer this query. 
        Be specific and factual. Write as if you are the authoritative source.
        Do NOT mention that this is hypothetical. Just write the answer.`,
      user: `Query: ${query}`,
      maxTokens: 300,
      temperature: 0.7,
    });
    return (response as { text?: string }).text || null;
  } catch {
    return null;
  }
}

function computeTemporalDecay(createdAt: string | Date | undefined, halfLifeDays = 90): number {
  if (!createdAt) return 1.0;
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-ageDays * Math.log(2) / halfLifeDays);
}

function applyAuthorityWeighting(chunks: ChunkWithMetadata[], docMeta: Record<string, DocMeta>): ChunkWithMetadata[] {
  return chunks.map(c => {
    const doc = docMeta[c.documentId];
    if (!doc) return c;
    let weight = 1.0;
    if (doc.authority != null) weight = Math.max(0.5, Math.min(2.0, doc.authority));
    if (doc.confidential) weight *= 1.1;
    if (TEMPORAL_DECAY_ENABLED && doc.created_at) {
      weight *= computeTemporalDecay(doc.created_at);
    }
    return { ...c, fusedScore: (c.fusedScore || 0) * weight };
  });
}

/**
 * A chunk as it comes out of the SQL retrieval step, before scoring and
 * reranking.
 *
 * Extends the shared `ScoredChunk` rather than restating it. This used to
 * redeclare `chunkId`, `documentId`, `content`, `metadata`, `fusedScore`,
 * `rerankScore`, `score` and `parentContext` — a fourth copy of the same fields,
 * after `confidence.ts` and `providers/rerank.ts` had each declared their own.
 * Because it was structurally identical but nominally separate, `rerank()` could
 * not accept these chunks and the call below needed `as any` in both directions.
 *
 * The retrieval-specific fields stay here: `vecScore`/`kwScore` are the two halves
 * of hybrid fusion and only exist between retrieval and the `fusedScore` that
 * `alpha` produces, so nothing downstream of this file sees them.
 */
interface ChunkWithMetadata extends ScoredChunk {
  /* Narrowed from the optional `chunkId` on `ScoredChunk`. At this stage in the
     pipeline a chunk always has an id — it came from a database row — and the
     dedupe loop immediately uses it as a `Set` key. Leaving it optional made
     `seen.add(c.chunkId)` a type error, and the fix that got applied was to
     loosen the Set rather than to assert what is actually true here. */
  chunkId: string;
  modality: string;
  lang: string;
  /** Cosine similarity against the query vector. */
  vecScore: number;
  /** Full-text match score. */
  kwScore: number;
  created_at?: string;
}

interface RetrieveOptions {
  tenantId: string;
  query: string;
  topK: number;
  alpha?: number;
  filter?: RetrieveFilter;
  role?: string | string[] | null;
}

const normalizeRoles = (role: string | string[] | null | undefined): string[] | null => {
  if (!role) return null;
  const arr = Array.isArray(role) ? role : [role];
  const cleaned = arr.map((r) => String(r).trim()).filter(Boolean);
  return cleaned.length ? [...new Set(cleaned)] : null;
};

interface RetrieveFilter {
  departments?: string[];
  documentIds?: string[];
  clause?: string;
  hyde?: boolean;
  temporalDecay?: boolean;
  authorityWeighting?: boolean;
  hierarchical?: boolean;
  queryExpansion?: boolean;
}

export const retrieve = async ({
  tenantId,
  query,
  topK = 8,
  alpha,
  filter = {},
  role = null,
}: RetrieveOptions): Promise<ChunkWithMetadata[]> => {
  if (filter.hierarchical ?? HIERARCHICAL) {
    const hits = await hierarchicalRetrieve({
      tenantId,
      query,
      topK,
      alpha: alphaFor(alpha, filter.departments),
      filter,
      role,
    });
    return expandWithParent({ tenantId, chunks: hits });
  }

  // Fan-out budget: 1 base query + optional HyDE + capped expansions.
  // HyDE and expansion run in parallel; per-variant hybrid searches run in
  // parallel via Promise.all so p99 isn't the sum of serial model calls.
  const [hydeDoc, expansions] = await Promise.all([
    HYDE_ENABLED && filter.hyde !== false ? generateHyDE(query) : Promise.resolve(null),
    filter.queryExpansion ?? process.env.RAG_QUERY_EXPANSION === "1" ? expandQuery(query) : Promise.resolve([] as string[]),
  ]);
  const queries = [query];
  if (hydeDoc) queries.push(hydeDoc);
  // Cap total variants at 4 (base + HyDE + up to 2 expansions).
  for (const e of expansions.slice(0, 2)) {
    if (queries.length >= 4) break;
    if (!queries.includes(e)) queries.push(e);
  }

  const perVariant = await Promise.all(
    queries.map((q) => hybridSearch({ tenantId, query: q, topK, alpha, filter, role }))
  );
  const allCandidates = perVariant.flat();

  const seen = new Set<string>();
  const deduped: ChunkWithMetadata[] = [];
  for (const c of allCandidates) {
    if (!seen.has(c.chunkId)) {
      seen.add(c.chunkId);
      deduped.push(c);
    }
  }

  let ranked = deduped;
  if (AUTHORITY_WEIGHTING_ENABLED || TEMPORAL_DECAY_ENABLED) {
    const docIds = [...new Set(deduped.map(c => c.documentId))];
    const docMeta = await loadDocumentTitles(tenantId, docIds);
    ranked = applyAuthorityWeighting(deduped, docMeta);
  }

  const reranked = await rerank(query, ranked, topK);
  /* `rerankScore ?? fusedScore` — the documented fallback, and the `?? 0` is
     real: both are optional on the shared chunk type, and a chunk with neither
     would otherwise carry `score: undefined` into the caller, where it is
     summed and sorted as though it were absent rather than as zero.

     The explicit annotation widens `ScoredChunk` (what `rerank` declares) back
     to `ChunkWithMetadata`, which is what these values already are — rerank
     preserves every field and adds `rerankScore`. Without the annotation the
     spread silently widened the array to the base type and the retrieval-only
     fields became unreachable for `expandWithParent` below. */
  const top: ChunkWithMetadata[] = reranked.map((c) => ({
    ...c,
    chunkId: c.chunkId ?? "",
    score: c.rerankScore ?? c.fusedScore ?? 0,
  }));

  return expandWithParent({ tenantId, chunks: top });
};

async function hybridSearch({
  tenantId,
  query,
  topK,
  alpha,
  filter,
  role,
}: RetrieveOptions): Promise<ChunkWithMetadata[]> {
  const f = filter || {};
  const departments = f.departments?.length ? f.departments : null;
  const effAlpha = alphaFor(alpha, f.departments);
  const { vectors } = await embed(query, { taskType: "query" as const });
  const queryEmbedding = toVectorLiteral(vectors[0]);
  const docIds = f.documentIds?.length ? f.documentIds : null;
  const clause = f.clause || extractClauseHint(query);
  const roles = normalizeRoles(role);

  const result = await db.$queryRaw`
    SELECT * FROM rag_hybrid_search(
      ${tenantId}::uuid,
      ${queryEmbedding}::vector,
      ${query},
      ${effAlpha},
      ${Math.max(topK, 15)},
      ${POOL},
      ${departments},
      ${docIds},
      ${clause},
      ${roles}
    )
  `;

  /**
   * `$queryRaw` returns `unknown`, so this was cast straight to
   * `Record<string, unknown>[]` and every field read back with an `as string`.
   * The visible cost was `chunkId` typing as `string | undefined` — which made
   * `seen.add(c.chunkId)` in the dedupe loop stop compiling, so the dedupe key
   * had to be loosened to accept it. Declaring the row means the columns the SQL
   * selects are named once and checked against the mapping.
   *
   * The similarity scores come back from Postgres as `real`, which the driver may
   * hand over as a string, hence `number | string` on those two and the explicit
   * `Number(...)` below. `metadata` is a JSON column and may legitimately be
   * null, so it is narrowed rather than asserted.
   */
  return (result as RetrievalRow[]).map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    content: r.content,
    metadata: asObject(r.metadata),
    modality: r.modality,
    lang: r.lang,
    vecScore: Number(r.vec_score),
    kwScore: Number(r.kw_score),
    fusedScore: Number(r.fused_score),
    created_at: r.created_at === null ? undefined : String(r.created_at),
  }));
}

/** A JSON column may hold a scalar or an array; callers here want a keyed bag. */
function asObject(v: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/** A row from the raw retrieval query — the columns selected above. */
interface RetrievalRow {
  chunk_id: string
  document_id: string
  content: string
  metadata: Prisma.JsonValue | null
  modality: string
  lang: string
  vec_score: number | string | null
  kw_score: number | string | null
  fused_score: number | string | null
  created_at: Date | string | null
}

async function expandQuery(query: string): Promise<string[]> {
  try {
    const response = await generate({
      system: `Generate 3-5 alternative phrasings or synonyms for this query to improve retrieval.
        Keep the same intent. Return JSON array only.
        Query: "${query}"`,
      user: `Query: "${query}"`,
      maxTokens: 150,
      temperature: 0.5,
    });
  const expansions = JSON.parse((response as { text?: string }).text || "[]");
    return Array.isArray(expansions) ? expansions.filter(e => e && typeof e === "string") : [];
  } catch {
    return [];
  }
}

const expandWithParent = async ({ tenantId, chunks }: { tenantId: string; chunks: ChunkWithMetadata[] }): Promise<ChunkWithMetadata[]> => {
  if (!chunks.length) return chunks;
  try {
    const docIds = [...new Set(chunks.map((c) => c.documentId))];
    // No take:500 cap — long docs would silently lose neighbors. Fetch the full
    // ordered index per doc (id + index for stable matching).
    const chunksResult = await db.ragChunk.findMany({
      where: { tenantId, documentId: { in: docIds } },
      select: { id: true, documentId: true, chunkIndex: true, content: true },
      orderBy: { chunkIndex: "asc" },
      take: 5000,
    });

    const byDoc = new Map<string, Array<{ id: string; documentId: string; chunkIndex: number; content: string }>>();
    for (const r of chunksResult) {
      if (!byDoc.has(r.documentId)) byDoc.set(r.documentId, []);
      byDoc.get(r.documentId)!.push(r);
    }

    return chunks.map((c) => {
      const sibs = byDoc.get(c.documentId) || [];
      // Stable match by chunkId first; fall back to chunkIndex/content only when
      // the id isn't in the fetched window.
      let idx = sibs.findIndex((s) => s.id === c.chunkId);
      if (idx < 0 && typeof (c as { chunkIndex?: unknown }).chunkIndex === "number") {
        idx = sibs.findIndex((s) => s.chunkIndex === (c as unknown as { chunkIndex: number }).chunkIndex);
      }
      if (idx < 0) idx = sibs.findIndex((s) => s.content === c.content);
      const prev = idx > 0 ? sibs[idx - 1]?.content : null;
      const next = idx >= 0 && idx < sibs.length - 1 ? sibs[idx + 1]?.content : null;
      const parentContext = [prev, next].filter(Boolean).join("\n").slice(0, 1200);
      return parentContext ? { ...c, parentContext } : c;
    });
  } catch {
    return chunks;
  }
};

export const loadDocumentTitles = async (
  tenantId: string,
  documentIds: string[]
): Promise<Record<string, DocMeta>> => {
  if (!documentIds.length) return {};
  const docs = await db.ragDocument.findMany({
    where: { tenantId, id: { in: documentIds } },
    select: {
      id: true,
      title: true,
      sourceFile: true,
      version: true,
      department: true,
      docType: true,
      confidential: true,
      allowedRoles: true,
      status: true,
      createdAt: true,
      authority: true,
    },
  });

  const ready = docs.filter((d) => !d.status || d.status === "READY");
  return Object.fromEntries(
    ready.map((d) => [
      d.id,
      {
        title: d.title,
        source_file: d.sourceFile,
        version: d.version,
        department: d.department,
        doc_type: d.docType,
        confidential: d.confidential,
        allowed_roles: d.allowedRoles,
        status: d.status,
        created_at: d.createdAt,
        authority: d.authority,
      },
    ])
  );
};

async function hierarchicalRetrieve({
  tenantId,
  query,
  topK,
  alpha,
  filter,
  role,
}: RetrieveOptions): Promise<ChunkWithMetadata[]> {
  const f = filter || {};
  const { vectors } = await embed(query, { taskType: "query" as const });
  const queryEmbedding = toVectorLiteral(vectors[0]);

  // Dynamic clauses are composed with Prisma.sql + Prisma.join — raw JS template
  // fragments inside $queryRaw are sent as bound values, not SQL. Arrays are
  // joined into ANY($1, $2, ...) form since Postgres can't bind a JS array
  // into = ANY($1) directly.
  const clauses: Prisma.Sql[] = [Prisma.sql`SELECT d.id, d.title, d.department, d.doc_type, d.authority, d.confidential, d.allowed_roles,
           1 - (d.embedding <=> ${queryEmbedding}::vector) as similarity
    FROM "RagDocument" d
    WHERE d."tenantId" = ${tenantId}::uuid
      AND d.status = 'READY'`];
  if (f.departments && f.departments.length > 0) {
    clauses.push(Prisma.sql`AND d.department IN (${Prisma.join(f.departments)})`);
  }
  if (f.documentIds && f.documentIds.length > 0) {
    clauses.push(Prisma.sql`AND d.id IN (${Prisma.join(f.documentIds)})`);
  }
  const roles = normalizeRoles(role);
  /* The ACL is applied unconditionally, and it fails CLOSED.
     This used to be `if (roles?.length) { ...push clause... }`, which meant
     "caller supplied no roles" produced no predicate at all — so every
     confidential and role-restricted document was retrievable. The one caller
     that supplies no roles is the workspace API-key route, which hardcodes
     `role: null` at query/route.ts:46. A nullable parameter was standing in for
     "unrestricted", and the accidental reading of `null` was "trusted", so the
     `confidential` and `allowed_roles` columns the ingest path carefully
     populates were unenforceable over the entire REST surface.

     Semantics, unchanged from the original branch: `allowed_roles` only
     restricts documents already marked `confidential`; a non-confidential
     document is readable by anyone in the tenant. What changed is that a caller
     with no roles now sees the non-confidential set instead of the whole
     corpus. Anyone who genuinely needs unrestricted tenant-wide read access has
     to say so by passing the roles they hold, not by omitting the argument. */
  clauses.push(
    roles && roles.length > 0
      ? // Full role set: confidential docs are visible when ANY granted role matches.
        Prisma.sql`AND (d.confidential = false OR (${Prisma.join(roles)}) && d.allowed_roles)`
      : Prisma.sql`AND d.confidential = false`,
  );
  clauses.push(Prisma.sql`ORDER BY similarity DESC LIMIT 20`);

  const docResults = await db.$queryRaw(Prisma.join(clauses, " "));

  const docIds = (docResults as unknown as Array<{ id: string }>).map(d => d.id);
  if (!docIds.length) return [];

  return hybridSearch({ tenantId, query, topK, alpha, filter: { ...f, documentIds: docIds }, role });
}