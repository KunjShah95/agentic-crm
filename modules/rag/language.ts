/**
 * Answer-language resolution for the RAG pipeline.
 *
 * Separate from `answer.ts` because it is a pure function of the user's text, and
 * because it has to be testable without standing up the rest of the pipeline —
 * `answer.ts` imports `db` and half the module graph at load time, so a test that
 * reached the logic through it would need the world mocked to assert a `switch`.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 *
 * The retrieval path rewrites every query into English. That is correct: the corpus
 * is English-language RERA and Gujarat regulation material, so an English
 * sub-query is what will match the documents.
 *
 * The defect was downstream. The rewritten query was also handed to the answering
 * model as "the question", and that model's prompt ended with "Answer in the same
 * language as the question." The model dutifully answered an English string in
 * English — so a Gujarati enquiry was answered in English, by an instruction that
 * read as though language were being handled.
 *
 * So the language has to be read from the user's own words, before any rewriting,
 * and stated explicitly in the prompt. Retrieval language and answer language are
 * different questions with different correct answers, and conflating them is what
 * broke this.
 */

import { detectLang } from "./chunk";

/**
 * Human-readable names for the scripts `detectLang` returns.
 *
 * Names, not tags, because these values go into prompts. The models are markedly
 * more reliable at "answer in Gujarati" than at "answer in `gu`", and a tag the
 * model cannot resolve degrades silently to English — the exact failure this
 * module exists to prevent.
 *
 * `und` is intentionally absent: `detectLang` returns it for text with no
 * readable script, which is not a language to write an answer in. It maps to
 * English via the fallback in `answerLanguage`.
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  ar: "Arabic",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ru: "Russian",
};

export type AnswerLanguage = {
  /** BCP-47-ish tag, as returned by `detectLang`. Used to partition caches. */
  tag: string;
  /** Display name for prompts. */
  name: string;
};

/**
 * The language an answer to this query must be written in.
 *
 * `tag` is the cache-partitioning key and `name` is what the prompt says, so the
 * two cannot drift: a caller cannot partition by one and prompt with the other.
 */
export const answerLanguage = (query: string): AnswerLanguage => {
  const tag = detectLang(query);
  return { tag, name: LANGUAGE_NAMES[tag] ?? "English" };
};

/**
 * Whether the answer to this query differs from what the user typed.
 *
 * Used to decide if the original wording is worth sending alongside the rewritten
 * question. A query that was not rewritten should not be duplicated into the
 * prompt, but a query that was must be — see `answer.ts`.
 */
export const wasRewritten = (original: string, rewritten: string): boolean => {
  const a = original.trim();
  const b = rewritten.trim();
  return a.length > 0 && a !== b;
};