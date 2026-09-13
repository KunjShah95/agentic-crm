/**
 * Generation LLM — Rotation/Fallback Pool over Free Cloud Tiers
 * Stateless, so rotating across providers is safe (unlike embeddings).
 */

import { fetchJson, runPool } from "./http";

interface LLMPayload {
  system: string;
  user: string;
  maxTokens?: number;
  stream?: boolean;
  temperature?: number;
}

interface LLMResponse {
  text: string;
  providerUsed: string;
}

type StreamGenerator = AsyncGenerator<{ text: string }>;

interface Provider {
  name: string;
  isEnabled: () => boolean;
  call: (payload: LLMPayload) => Promise<LLMResponse>;
  stream?: (payload: LLMPayload) => StreamGenerator;
}

const ALL: Record<string, Provider> = {};

const poolOrder = (process.env.RAG_LLM_POOL || "groq,gemini,mistral,nvidia")
  .split(",")
  .map((s) => s.trim())
  .filter((n) => ALL[n]);

// Groq (OpenAI-compatible) — fast, generous free tier.
ALL.groq = {
  name: "groq",
  isEnabled: () => !!process.env.GROQ_API_KEY,
  call: async ({ system, user, maxTokens }): Promise<LLMResponse> => {
    const json = await fetchJson("https://api.groq.com/openai/v1/chat/completions", {
      headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: {
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0,
        max_tokens: maxTokens || 1024,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
    });
    return { text: (json as any).choices?.[0]?.message?.content || "", providerUsed: "groq" };
  },
  stream: async function* ({ system, user, maxTokens }) {
    const fetch = (await import("node-fetch")).default;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0,
        max_tokens: maxTokens || 1024,
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.body) return;

    const reader = (res.body as unknown as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                yield { text: delta };
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      console.error("[rag] Groq streaming error", { err });
    }
  },
};

// Mistral (OpenAI-compatible).
ALL.mistral = {
  name: "mistral",
  isEnabled: () => !!process.env.MISTRAL_API_KEY,
  call: async ({ system, user, maxTokens }): Promise<LLMResponse> => {
    const json = await fetchJson("https://api.mistral.ai/v1/chat/completions", {
      headers: { authorization: `Bearer ${process.env.MISTRAL_API_KEY}` },
      body: {
        model: process.env.MISTRAL_MODEL || "mistral-small-latest",
        temperature: 0,
        max_tokens: maxTokens || 1024,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
    });
    return { text: (json as any).choices?.[0]?.message?.content || "", providerUsed: "mistral" };
  },
};

// Google Gemini (generative language API).
ALL.gemini = {
  name: "gemini",
  isEnabled: () => !!process.env.GEMINI_API_KEY,
  call: async ({ system, user, maxTokens }): Promise<LLMResponse> => {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const json = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        body: {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0, maxOutputTokens: maxTokens || 1024 },
        },
      }
    );
    return { text: (json as any).candidates?.[0]?.content?.parts?.[0]?.text || "", providerUsed: "gemini" };
  },
};

// NVIDIA NIM (OpenAI-compatible).
ALL.nvidia = {
  name: "nvidia",
  isEnabled: () => !!process.env.NVIDIA_API_KEY,
  call: async ({ system, user, maxTokens }): Promise<LLMResponse> => {
    const json = await fetchJson("https://integrate.api.nvidia.com/v1/chat/completions", {
      headers: { authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
      body: {
        model: process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct",
        temperature: 0,
        max_tokens: maxTokens || 1024,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
    });
    return { text: (json as any).choices?.[0]?.message?.content || "", providerUsed: "nvidia" };
  },
};

/**
 * Mock: extractive fallback — echoes first context lines so answers still cite.
 */
const mock = async ({ user }: LLMPayload): Promise<LLMResponse> => {
  const ctx = (user.match(/\[Source 1[^\]]*\][\s\S]{0,240}/) || [""])[0].replace(/\s+/g, " ").trim();
  return { text: ctx ? `${ctx} [Source 1]` : "The provided documents do not contain sufficient information to answer this question.", providerUsed: "mock" };
};

/**
 * generate({system, user, maxTokens, stream}) -> { text, providerUsed } | AsyncIterable<{ text }>
 */
export const generate = async (payload: LLMPayload): Promise<LLMResponse | StreamGenerator> => {
  const { stream = false } = payload;

  if (stream) {
    return runPool("llm", poolOrder.map((n) => ALL[n]), payload, async function* () {
      const mockResult = await mock(payload);
      const text = mockResult.text;
      const chunkSize = 20;
      for (let i = 0; i < text.length; i += chunkSize) {
        yield { text: text.slice(i, i + chunkSize) };
      }
    } as any) as any;
  }

  return runPool("llm", poolOrder.map((n) => ALL[n]), payload, mock);
};

export { ALL as providers };
export type { LLMResponse, StreamGenerator };