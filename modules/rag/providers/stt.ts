/**
 * Speech-to-Text Provider — Transcription Pool
 * Groq Whisper + HuggingFace fallback.
 */

import { fetchJson, runPool } from "./http";

interface STTInput {
  audio: Blob;
}

interface STTResponse {
  text: string;
  providerUsed: string;
}

const groqWhisper = {
  name: "groq-whisper",
  isEnabled: () => !!process.env.GROQ_API_KEY,
  call: async ({ audio }: STTInput): Promise<STTResponse> => {
    const formData = new FormData();
    formData.append("file", audio, "audio.wav");
    formData.append("model", "whisper-large-v3");
    formData.append("response_format", "text");

    const fetch = (await import("node-fetch")).default;
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq Whisper HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const text = await res.text();
    return { text, providerUsed: "groq-whisper" };
  },
};

const hfSTT = {
  name: "hf-stt",
  isEnabled: () => !!process.env.HF_API_KEY,
  call: async ({ audio }: STTInput): Promise<STTResponse> => {
    const arrayBuffer = await audio.arrayBuffer();
    const fetch = (await import("node-fetch")).default;
    const res = await fetch("https://api-inference.huggingface.co/models/openai/whisper-large-v3", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.HF_API_KEY}` },
      body: Buffer.from(arrayBuffer),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HF STT HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json() as { text?: string };
    return { text: json.text || "", providerUsed: "hf-stt" };
  },
};

const mockSTT = async (): Promise<STTResponse> => ({
  text: "[Audio transcription unavailable]",
  providerUsed: "mock",
});

export const transcribe = async (input: STTInput): Promise<STTResponse> => {
  return runPool("stt", [groqWhisper, hfSTT], input, mockSTT);
};