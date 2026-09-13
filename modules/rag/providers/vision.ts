/**
 * Vision Provider — OCR + Caption for Images
 * Uses provider pool with fail-open mock.
 */

import { fetchJson, runPool } from "./http";

interface VisionInput {
  imageBase64: string;
  mime: string;
}

interface VisionResponse {
  text: string;
  providerUsed: string;
}

// Sarvam (Indic languages primary)
const sarvam = {
  name: "sarvam-vision",
  isEnabled: () => !!process.env.SARVAM_API_KEY,
  call: async ({ imageBase64, mime }: VisionInput): Promise<VisionResponse> => {
    const json = await fetchJson<{ text?: string; caption?: string }>(
      "https://api.sarvam.ai/vision/analyze",
      {
        headers: { authorization: `Bearer ${process.env.SARVAM_API_KEY}` },
        body: { image: imageBase64, mime_type: mime, task: "ocr+caption" },
      }
    );
    return { text: json.text || json.caption || "", providerUsed: "sarvam" };
  },
};

// Google Gemini Vision
const geminiVision = {
  name: "gemini-vision",
  isEnabled: () => !!process.env.GEMINI_API_KEY,
  call: async ({ imageBase64, mime }: VisionInput): Promise<VisionResponse> => {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const json = await fetchJson<any>(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        body: {
          contents: [
            {
              role: "user",
              parts: [
                { text: "Extract all text and describe this image in detail for document retrieval." },
                { inline_data: { mime_type: mime, data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 1024 },
        },
      }
    );
    return { text: json.candidates?.[0]?.content?.parts?.[0]?.text || "", providerUsed: "gemini" };
  },
};

// Mock
const mockVision = async (): Promise<VisionResponse> => ({
  text: "[Image content - OCR/vision unavailable]",
  providerUsed: "mock",
});

/**
 * vision({imageBase64, mime}) -> { text, providerUsed }
 */
export const vision = async (input: VisionInput): Promise<VisionResponse> => {
  return runPool("vision", [sarvam, geminiVision], input, mockVision);
};