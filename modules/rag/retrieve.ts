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

const DEFAULT_ALPHA = Number(process.env.RAG_ALPHA || 0.5);
const POOL = Number(process.env.RAG_POOL || 30);

const HIERARCHICAL = process.env.RAG_HIERARCHICAL === "1";

const HYDE_ENABLED = process.env.RAG_HYDE === "1";
const TEMPORAL_DECAY_ENABLED = process.env.RAG_TEMPORAL_DECAY === "1";
const AUTHORITY_WEIGHTING_ENABLED = process.env.RAG_AUTHORITY_WEIGHTING === "1";
const MULTI_VECTOR_ENABLED = process.env.RAG_MULTI_VECTOR === "1";

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

interface ChunkWithMetadata {
  chunkId: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  modality: string;
  lang: string;
  vecScore: number;
  kwScore: number;
  fusedScore: number;
  created_at?: string;
  rerankScore?: number;
  score?: number;
  parentContext?: string;
}

interface DocMeta {
  title: string | null;
  source_file: string | null;
  version: number;
  department: string | null;
  doc_type: string | null;
  confidential: boolean;
  allowed_roles: string[];
  status: string | null;
  created_at: Date | null;
  authority: number | null;
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
  multiVector?: boolean;
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
    ranked = applyAuthorityWeighting(deduped as any, docMeta as any);
  }

  const reranked = await rerank(query, ranked as any, topK) as any;
  const top = reranked.map((c: any) => ({ ...c, score: c.rerankScore ?? c.fusedScore }));

  return expandWithParent({ tenantId, chunks: top }) as any;
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

  return (result as unknown as Record<string, unknown>[]).map((r) => ({
    chunkId: r.chunk_id as string,
    documentId: r.document_id as string,
    content: r.content as string,
    metadata: r.metadata as Record<string, unknown>,
    modality: r.modality as string,
    lang: r.lang as string,
    vecScore: Number(r.vec_score),
    kwScore: Number(r.kw_score),
    fusedScore: Number(r.fused_score),
    created_at: r.created_at as string,
  }));
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
  if (roles && roles.length > 0) {
    // Full role set: confidential docs are visible when ANY granted role matches.
    clauses.push(
      Prisma.sql`AND (d.confidential = false OR (${Prisma.join(roles)}) && d.allowed_roles)`
    );
  }
  clauses.push(Prisma.sql`ORDER BY similarity DESC LIMIT 20`);

  const docResults = await db.$queryRaw(Prisma.join(clauses, " "));

  const docIds = (docResults as unknown as Array<{ id: string }>).map(d => d.id);
  if (!docIds.length) return [];

  return hybridSearch({ tenantId, query, topK, alpha, filter: { ...f, documentIds: docIds }, role });
}