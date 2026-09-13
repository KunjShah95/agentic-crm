/**
 * Video Parser — FFmpeg-based Audio/Frame Extraction
 * Requires ffmpeg binary on PATH.
 */

import { spawn } from "child_process";
import { createWriteStream, createReadStream, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

interface ExtractResult {
  audioBuffer: Buffer | null;
  frames: Buffer[];
}

/**
 * Extract audio track (16kHz mono WAV) and keyframe JPEGs from video buffer.
 * Returns { audioBuffer, frames[] }
 */
export const extractAudioAndFrames = async (videoBuffer: Buffer, filename: string): Promise<ExtractResult> => {
  const workDir = tmpdir();
  const inputPath = join(workDir, `${randomUUID()}-${filename}`);
  const audioPath = join(workDir, `${randomUUID()}.wav`);
  const framePattern = join(workDir, `${randomUUID()}-%04d.jpg`);

  // Write video to temp file
  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(inputPath);
    ws.write(videoBuffer);
    ws.end();
    ws.on("finish", resolve);
    ws.on("error", reject);
  });

  try {
    // Extract audio: 16kHz mono WAV
    await runFfmpeg([
      "-y",
      "-i", inputPath,
      "-vn",
      "-acodec", "pcm_s16le",
      "-ar", "16000",
      "-ac", "1",
      audioPath,
    ]);

    // Extract keyframes (1 per second, max 10)
    await runFfmpeg([
      "-y",
      "-i", inputPath,
      "-vf", "fps=1,select='eq(pict_type,I)'",
      "-vsync", "vfr",
      "-q:v", "2",
      "-frames:v", "10",
      framePattern,
    ]);

    // Read audio
    let audioBuffer: Buffer | null = null;
    try {
      const audioChunks: Buffer[] = [];
      for await (const chunk of createReadStream(audioPath)) {
        audioChunks.push(chunk);
      }
      audioBuffer = Buffer.concat(audioChunks);
    } catch {
      // audio extraction may fail for videos without audio track
    }

    // Read frames
    const frames: Buffer[] = [];
    const fs = await import("fs");
    const files = fs.readdirSync(workDir).filter(f => f.endsWith(".jpg") && f.startsWith(framePattern.split("/").pop()!.replace("%04d", "")));
    for (const f of files.sort()) {
      const frameData = fs.readFileSync(join(workDir, f));
      frames.push(frameData);
    }

    return { audioBuffer, frames };
  } finally {
    // Cleanup
    try { unlinkSync(inputPath); } catch {}
    try { unlinkSync(audioPath); } catch {}
    const fs = await import("fs");
    const files = fs.readdirSync(workDir).filter(f => f.endsWith(".jpg") && f.startsWith(framePattern.split("/").pop()!.replace("%04d", "")));
    for (const f of files) {
      try { unlinkSync(join(workDir, f)); } catch {}
    }
  }
};

const runFfmpeg = (args: string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(0, 500)}`));
    });
    proc.on("error", (e) => reject(new Error(`ffmpeg spawn failed: ${e.message} (is ffmpeg installed?)`)));
  });
};