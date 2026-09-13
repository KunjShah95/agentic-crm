/**
 * Parsers — Route uploaded files to the right parser by modality/mime
 * Text formats are fully wired. PDF/DOCX use optional deps if present.
 * Image/audio go through provider pools. Video needs ffmpeg (local) — extract audio+keyframes.
 */

import { vision } from "../providers/vision";
import { transcribe } from "../providers/stt";

const stripHtml = (html: string): string =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");

export const detectModality = (mime = "", filename = ""): "text" | "image" | "audio" | "video" => {
  const m = mime.toLowerCase();
  const f = filename.toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/.test(f)) return "image";
  if (m.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|flac|aac)$/.test(f)) return "audio";
  if (m.startsWith("video/") || /\.(mp4|mov|mkv|webm|avi)$/.test(f)) return "video";
  return "text";
};

const parseText = async (buffer: Buffer, mime: string, filename: string): Promise<string> => {
  const f = (filename || "").toLowerCase();
  if (mime?.includes("html") || /\.html?$/.test(f)) return stripHtml(buffer.toString("utf8"));
  if (mime?.includes("pdf") || /\.pdf$/.test(f)) {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      return (await pdfParse(buffer)).text;
    } catch {
      throw new Error("PDF parsing requires the 'pdf-parse' package (npm i pdf-parse)");
    }
  }
  if (/\.docx$/.test(f) || mime?.includes("officedocument.wordprocessing")) {
    try {
      const mammoth = await import("mammoth");
      return (await mammoth.extractRawText({ buffer })).value;
    } catch {
      throw new Error("DOCX parsing requires the 'mammoth' package (npm i mammoth)");
    }
  }
  return buffer.toString("utf8");
};

const parseImage = async (buffer: Buffer, mime: string): Promise<string> => {
  const { text, providerUsed } = await vision({ imageBase64: buffer.toString("base64"), mime });
  console.info(`rag/parse image via ${providerUsed}`);
  return text;
};

const parseAudio = async (buffer: Buffer, mime: string): Promise<string> => {
  const audio = new Blob([new Uint8Array(buffer)], { type: mime || "audio/mpeg" });
  const { text, providerUsed } = await transcribe({ audio });
  console.info(`rag/parse audio via ${providerUsed}`);
  return text;
};

const parseVideo = async (buffer: Buffer, mime: string, filename: string): Promise<string> => {
  try {
    const { extractAudioAndFrames } = await import("./video.ffmpeg");
    const { audioBuffer, frames } = await extractAudioAndFrames(buffer, filename);
    const parts: string[] = [];
    if (audioBuffer) {
      const { text } = await transcribe({ audio: new Blob([new Uint8Array(audioBuffer)], { type: "audio/wav" }) });
      if (text) parts.push(`Transcript: ${text}`);
    }
    for (const frame of frames) {
      const { text } = await vision({ imageBase64: frame.toString("base64"), mime: "image/jpeg" });
      if (text) parts.push(`Keyframe: ${text}`);
    }
    return parts.join("\n\n");
  } catch (e) {
    throw new Error(`Video ingest failed (needs ffmpeg): ${(e as Error).message}`);
  }
};

export interface ParseResult {
  text: string;
  modality: "text" | "image" | "audio" | "video";
}

export const parseFile = async ({ buffer, mime, filename }: { buffer: Buffer; mime: string; filename: string }): Promise<ParseResult> => {
  const modality = detectModality(mime, filename);
  let text: string;
  if (modality === "image") text = await parseImage(buffer, mime);
  else if (modality === "audio") text = await parseAudio(buffer, mime);
  else if (modality === "video") text = await parseVideo(buffer, mime, filename);
  else text = await parseText(buffer, mime, filename);
  return { text: text || "", modality };
};