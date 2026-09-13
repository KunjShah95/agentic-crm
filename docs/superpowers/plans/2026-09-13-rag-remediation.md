# Plan 2 — RAG Remediation — 2026-09-13

Spec: `docs/superpowers/specs/2026-09-13-crm-architecture-rag-design.md` Deliverable 2.
Non-goals (YAGNI): no new RAG features, no unrelated refactors, no suite beyond smoke + one real-provider run, no infra changes.

## Baseline discrepancy (verified 2026-09-13)
- Spec claims 38 errors (`ingest.ts` 23, `answer.ts` 8, `chunk.ts` 4, `providers/llm.ts` 2, `retrieve.ts` 1).
- `npx tsc --noEmit` on current tree (HEAD `f59ea75`) returns **zero output / exit 0** — claim does not reproduce. Do not assume fixed; re-baseline per task 1 before editing. Possible causes: tree drift (large `git status`, incl. untracked `app/api/v1/tenants/` + modified `prisma/schema.prisma`), or differing tsc invocation.

## Root-cause inventory (from code read, exact sites)
1. **Prisma `metadata` JSON**: column `prisma/schema.prisma:805` (`Json?`); producers `modules/rag/chunk.ts:75,220-231`, `ingest.ts:49,305,314,325,336,344`; readers `ingest.ts:272,298`, `retrieve.ts:75,216`, `answer.ts:61,286,305,328`, `types.ts:98,106` (`Record<string,unknown>` vs `InputJsonValue`/`JsonValue|null`).
2. **Vector `Unsupported("vector(1024)")`** (`schema.prisma:802`): typed-client access at `ingest.ts:272,298,326`, `queue.ts:84-85,104-111` (`as any` writes). No shared helper exists — only ad-hoc `db.$queryRaw` at `retrieve.ts:197-210` (via `toVectorLiteral:32`) and `:327-338`. Fix = small `workspaceId`-scoped raw-SQL helper for vector read/write; route all embedding I/O through it.
3. **DocMeta collision**: `retrieve.ts:87-98` (full, snake_case) vs `confidence.ts:10-13` (minimal, file-local); erasure at `answer.ts:215,237,253,266,287,303-304` (`Record<string,unknown>` + `as any`). Fix = single exported `DocMeta`, adapt call sites.
4. **Section shape**: `chunk.ts:115-121` (`interface Section`, not exported; `lines?` optional) vs `126,128-132,146,150` usage + `splitSections:123` return-type exposure. Fix = export + consistent `lines` handling/guards.
5. **`runPool` typing**: `providers/http.ts:14-18,49-54` generic vs `providers/llm.ts:23-28` local `Provider` (+`stream?`); `llm.ts:32-35` (`poolOrder` built when `ALL={}` → always `[]`) + `188-203` (`as any` at `192,202`). Fix = unify provider type, fix registration order, type mock return (`TOut & {providerUsed}`).
6. **Retrieve shape drift**: producer `retrieve.ts:71-85,212-223` (`ChunkWithMetadata`, no `chunk_index`) vs `answer.ts:259` (`c.chunk_index||0` → always 0, dedupe collision) + `confidence.ts:15-22` (`ChunkWithScore`) bridged by `as any` (`answer.ts:245,266`, `retrieve.ts:174-177`); `query-enhancer.ts:131,140` third convention (`id||chunk_index`); `retrieve.ts:249,262` parent-expansion without `id`. Fix at sites + one id convention.
7. **Env**: zero `RAG_*`/provider keys in `.env`, `.env.example:1-17`, `.env.local`. All code paths have mock/default fallbacks (see Plan 1 env matrix). Real-provider run gated on user-supplied keys.

## Tasks
1. Re-baseline: run `npx tsc --noEmit`, record per-file counts; if zero, verify `modules/rag` is type-checked (no exclude/skip) and diff against spec's error list before touching code.
2. Fix in order: (a) vector helper + `ingest.ts`/`queue.ts` embedding I/O; (b) `metadata` JSON casts; (c) `DocMeta` unify; (d) `Section` export/guards; (e) `runPool`/`llm.ts` pool order + types; (f) `retrieve.ts`/`answer.ts`/`confidence.ts`/`query-enhancer.ts` id/score convergence. Keep `workspaceId` scoping on all raw SQL.
3. Guard documented in spec §Risks: pin one embedding model per workspace/corpus; provider switch ⇒ reindex (never mix mock + real vectors); enforce/code-comment.
4. Smoke test (mock): ingest small text doc + one query via route (`app/api/v1/tenants/[tenantId]/rag/query/route.ts:34-48`) or direct `answerQuery` call → answer + citation, no throw. Capture output to file.
5. Real-provider run (gated on keys `RAG_EMBED_PROVIDER=jina`+`JINA_API_KEY`, e.g. `GROQ_API_KEY`): repeat → real embedding + answer + citation. Capture output. If keys absent, leave as pending with explicit note — do not block smoke test.

## Verification (evidence before done)
- `npx tsc --noEmit` → zero `modules/rag` errors (paste output).
- Smoke-test transcript captured (mock answer + citation).
- Real-provider transcript captured once keys present, or marked pending with key names listed.

## Risks
- `Unsupported("vector(1024)")` forces raw SQL — must stay `workspaceId`-scoped (RLS backstop in `..._enable_rag_rls/migration.sql`, not primary guard).
- Mock/real embedding mixing → incomparable vectors; reindex on switch.
