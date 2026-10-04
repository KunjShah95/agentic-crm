/**
 * Text Normalization + Token-Aware Chunking + Lightweight Language Detection
 * No new dependencies: chunking approximates tokens by words, language detection
 * uses Unicode script ranges
 */

import crypto from "crypto";

/**
 * Stable per-chunk content hash — drives incremental re-ingest diffing.
 * Same text -> same hash regardless of position, so moved-but-unchanged
 * paragraphs keep their embeddings.
 */
export const hashChunk = (content = "") =>
  crypto.createHash("sha256").update(String(content)).digest("hex").slice(0, 32);

/**
 * SYNCHRONIC step S: NFC normalize, strip control chars, standardize whitespace.
 */
export const normalizeText = (input: string): string =>
  String(input || "")
    .normalize("NFC")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // control chars (keep \t \n)
    .replace(/ /g, " ") // non-breaking space -> space (silent recall killer)
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const SCRIPTS: Array<[string, RegExp]> = [
  ["hi", /[ऀ-ॿ]/], // Devanagari
  ["bn", /[ঀ-৿]/], // Bengali
  ["ta", /[஀-௿]/], // Tamil
  ["te", /[ఀ-౿]/], // Telugu
  ["gu", /[઀-૿]/], // Gujarati
  ["kn", /[ಀ-೿]/], // Kannada
  ["ml", /[ഀ-ൿ]/], // Malayalam
  ["pa", /[਀-੿]/], // Gurmukhi
  ["ar", /[؀-ۿ]/], // Arabic
  ["zh", /[一-鿿]/], // CJK
  ["ja", /[぀-ヿ]/], // Hiragana/Katakana
  ["ko", /[가-힯]/], // Hangul
  ["ru", /[Ѐ-ӿ]/], // Cyrillic
];

/**
 * Dominant language tag by script frequency; falls back to 'en' for Latin, 'und' if empty.
 */
export const detectLang = (text: string): string => {
  const t = String(text || "");
  if (!t.trim()) return "und";
  let best: string | null = null;
  let bestCount = 0;
  for (const [lang, re] of SCRIPTS) {
    const m = t.match(new RegExp(re.source, "g"));
    const count = m ? m.length : 0;
    if (count > bestCount) {
      bestCount = count;
      best = lang;
    }
  }
  if (best && bestCount > 3) return best;
  return /[A-Za-z]/.test(t) ? "en" : "und";
};

// ~512-token chunks with overlap. Approx: 1 token ~= 0.75 words -> ~380 words/chunk.
const WORDS_PER_CHUNK = Number(process.env.RAG_CHUNK_WORDS || 380);
const OVERLAP_WORDS = Number(process.env.RAG_CHUNK_OVERLAP || 50);

export interface ChunkOutput {
  content: string;
  chunk_index: number;
  chunk_hash: string;
  lang: string;
  metadata: Record<string, unknown>;
}

/**
 * chunkText(text, opts) -> chunks
 * Two modes (backward compatible):
 *  - plain (no headings): legacy fixed word-window 380/50
 *  - structured: split on markdown headings + numbered clauses
 *    ("4.2 Sick Leave", "Section 4.2", "Clause 7"), then word-window
 *    *within* each section so a chunk never mixes HR §4 with Marketing §9.
 *    Each chunk carries metadata.section_path for sub-section retrieval.
 */
export const chunkText = (raw: string, opts: Record<string, unknown> = {}): ChunkOutput[] => {
  const text = normalizeText(raw);
  if (!text) return [];
  const sections = splitSections(text);
  // Plain path — identical to legacy behavior
  if (sections.length <= 1 && !sections[0]?.heading) {
    return windowWords(text, {}, opts);
  }
  const out: ChunkOutput[] = [];
  let idx = 0;
  for (const sec of sections) {
    const sub = windowWords(
      sec.body,
      { section_path: sec.path, heading: sec.heading, clause_id: sec.clauseId },
      opts
    );
    for (const c of sub) {
      c.chunk_index = idx++;
      out.push(c);
    }
  }
  return out;
};

// Split normalized text into sections by headings / clause markers.
const HEADING_RE = /^(#{1,4}\s+.+|[A-Z][\w\s,&'-]{2,80}:?\s*$|(?:Section|Clause|Article|§)\s+[0-9A-Z][\w.\-]*.*|(?:\d+(?:\.\d+)+)\s+.+)$/;
const CLAUSE_ID_RE = /(?:Section|Clause|Article|§)?\s*(\d+(?:\.\d+)+)/i;

interface Section {
  heading: string | null;
  clauseId: string | null;
  path: string[];
  body: string;
  lines?: string[];
}

export const splitSections = (normalizedText: string): Section[] => {
  const lines = String(normalizedText || "").split("\n");
  const sections: Section[] = [];
  let cur: Section = { heading: null, clauseId: null, path: [], body: "", lines: [] };
  let currentPath: string[] = [];
  const push = () => {
    const body = (cur.lines || []).join("\n").trim();
    if (body || cur.heading) {
      sections.push({ heading: cur.heading, clauseId: cur.clauseId, path: cur.path, body: body || cur.heading || "" });
    }
  };
  for (const line of lines) {
    const t = line.trim();
    if (t && HEADING_RE.test(t) && t.length < 160) {
      push();
      const m = t.match(CLAUSE_ID_RE);
      const heading = t.replace(/^#+\s*/, "").slice(0, 160);
      const level = t.match(/^(#{1,4})\s+/)?.[1]?.length || 2;
      if (level <= 1) currentPath = [heading];
      else if (level === 2) currentPath = currentPath.length && currentPath[0] !== heading ? [currentPath[0], heading] : [heading];
      else currentPath = [...currentPath.slice(0, level - 1), heading].slice(0, 3);
      cur = { heading, clauseId: m?.[1] || null, path: [...currentPath], body: "", lines: [] };
    } else {
      (cur.lines ||= []).push(line);
    }
  }
  push();
  if (!sections.length) return [{ heading: null, clauseId: null, path: [], body: normalizedText }];
  return sections;
};

/**
 * PII redaction at chunk time (HR docs often contain emails/phones/IDs).
 * Keeps retrieval safe; original file bytes are untouched, only indexed text.
 */
export const redactPII = (s = ""): string =>
  String(s)
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/(\+?\d[\d\s\-()]{7,}\d)/g, "[phone]")
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[id]");

/**
 * Word-window a single section body, tagging section metadata.
 * Sentence-aware: never cut mid-sentence unless a single sentence exceeds the
 * window; markdown tables are kept as one atomic block (row splits kill recall).
 */
/**
 * Read a positive integer override, falling back to the default.
 *
 * `Number(...)` alone is not enough. Every comparison below is against `wordsPer`,
 * and every one of them is false when it is `NaN` — so a malformed value does not
 * produce a wrong chunk size, it produces no chunks at all: the sentence loop's
 * `w > wordsPer` and `bufLen + w > wordsPer` are both false, every sentence falls
 * into the buffer, and `pushWindow` then computes `step = Math.max(1, NaN - NaN)`
 * and breaks on the empty first slice.
 *
 * The document is then ingested with no chunks at all. That is the worst possible
 * outcome for this module and it is completely silent — no error, no log, and a
 * document that simply never matches any query. Reachable from a bad
 * `RAG_CHUNK_WORDS` in the environment or a bad `opts` value at a call site.
 */
const positiveInt = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const windowWords = (text: string, sectionMeta: SectionMeta = {}, opts: Record<string, unknown> = {}): ChunkOutput[] => {
  const wordsPer = positiveInt(opts.wordsPerChunk ?? process.env.RAG_CHUNK_WORDS, WORDS_PER_CHUNK);
  const overlap = Math.min(
    positiveInt(opts.overlapWords ?? process.env.RAG_CHUNK_OVERLAP, OVERLAP_WORDS),
    /* Overlap must be smaller than the window, or `step` clamps to 1 and every
       chunk re-emits the entire document from offset 0. Capping here rather than
       trusting the caller, because this is reachable from an env var. */
    Math.max(1, wordsPer - 1)
  );
  const redacted = opts.redact === false ? String(text || "") : redactPII(String(text || ""));
  // Keep tables atomic: split out table blocks, window prose normally.
  const blocks = redacted.split(/((?:^\|.*\|\s*\n?)+)/m).filter((b) => b && b.trim());
  const chunks: ChunkOutput[] = [];
  let idx = 0;
  const pushWindow = (words: string[]) => {
    const step = Math.max(1, wordsPer - overlap);
    for (let start = 0; start < words.length; start += step) {
      const slice = words.slice(start, start + wordsPer);
      if (!slice.length) break;
      chunks.push(makeChunk(slice.join(" "), idx++, sectionMeta, words.slice(0, start).join(" ").length));
      if (start + wordsPer >= words.length) break;
    }
  };
  for (const b of blocks) {
    if (/^\|.*\|/.test(b.trim())) {
      // Table block: one chunk (truncate if pathological).
      const words = b.split(/\s+/).filter(Boolean).slice(0, wordsPer);
      chunks.push(makeChunk(words.join(" "), idx++, sectionMeta, 0));
    } else {
      // Sentence-split, then greedy-pack sentences to ~wordsPer.
      const sentences = b.match(/[^.!?\n]+[.!?]+["']?\s*|\n\s*\n|[^.!?\n]+$/g) || [b];
      let buf: string[] = [];
      let bufLen = 0;
      for (const s of sentences) {
        const w = s.split(/\s+/).filter(Boolean).length;
        if (w > wordsPer) {
          if (buf.length) {
            pushWindow(buf.join(" ").split(/\s+/));
            buf = [];
            bufLen = 0;
          }
          pushWindow(s.split(/\s+/).filter(Boolean));
        } else if (bufLen + w > wordsPer && buf.length) {
          pushWindow(buf.join(" ").split(/\s+/));
          buf = [s];
          bufLen = w;
        } else {
          buf.push(s);
          bufLen += w;
        }
      }
      if (buf.length) pushWindow(buf.join(" ").split(/\s+/));
    }
  }
  return chunks;
};

/**
 * The per-section provenance the chunker copies into chunk metadata.
 *
 * `null` rather than `undefined` for the optional members because that is what
 * the section parser produces — `parseSections` builds `Section` with
 * `heading: null, clauseId: null` for a section with neither. Declaring
 * `undefined` here meant the call site could not pass its own values without a
 * cast, which is how `section_path` ended up read through `as any`.
 */
interface SectionMeta {
  /** Ancestor heading path, outermost first. */
  section_path?: string[] | null
  heading?: string | null
  clause_id?: string | number | null
  [key: string]: unknown
}

const makeChunk = (content: string, idx: number, sectionMeta: SectionMeta, charOffset: number): ChunkOutput => ({
  content,
  chunk_index: idx,
  chunk_hash: hashChunk(content),
  lang: detectLang(content),
  metadata: {
    char_offset: charOffset,
    ...(sectionMeta.section_path?.length ? { section_path: sectionMeta.section_path } : {}),
    ...(sectionMeta.heading ? { heading: sectionMeta.heading } : {}),
    ...(sectionMeta.clause_id ? { clause_id: sectionMeta.clause_id } : {}),
  },
});

/**
 * Extract a clause hint ("4.2", "section 4.2") from a user query for boosting.
 */
export const extractClauseHint = (query = ""): string | null => {
  const m = String(query).match(/(?:section|clause|article|§)?\s*(\d+(?:\.\d+)+)/i);
  return m?.[1] || null;
};