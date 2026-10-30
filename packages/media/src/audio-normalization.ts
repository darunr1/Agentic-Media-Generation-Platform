import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/**
 * Prepare TTS audio for renderScenes, which reads its voice track as voice.wav.
 * Only explicit audio formats are accepted; FFmpeg produces 48 kHz mono PCM16 WAV.
 * This is format normalization, not loudness normalization. The existing mock
 * voice/render path is intentionally unchanged.
 */
export async function prepareSpeechAudioForRender(
  input: { bytes: Uint8Array; mimeType: string },
  signal?: AbortSignal,
): Promise<Uint8Array> {
  signal?.throwIfAborted();
  const extension =
    input.mimeType === "audio/wav" || input.mimeType === "audio/x-wav"
      ? "wav"
      : input.mimeType === "audio/mpeg"
        ? "mp3"
        : null;
  if (!extension) throw new Error("Unsupported speech audio format");
  if (!input.bytes.byteLength || input.bytes.byteLength > MAX_INPUT_BYTES)
    throw new Error("Invalid speech audio size");

  const temp = await mkdtemp(join(tmpdir(), "contentforge-audio-"));
  try {
    const source = join(temp, "speech." + extension);
    const target = join(temp, "voice.wav");
    await writeFile(source, input.bytes);
    try {
      await execFileAsync(
        process.env.FFMPEG_PATH ?? ffmpegPath ?? "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-nostdin",
          "-y",
          "-i",
          source,
          "-map",
          "0:a:0",
          "-vn",
          "-ac",
          "1",
          "-ar",
          "48000",
          "-c:a",
          "pcm_s16le",
          target,
        ],
        { windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024, signal },
      );
    } catch (error) {
      signal?.throwIfAborted();
      throw new Error("Failed to normalize speech audio for rendering", { cause: error });
    }
    return await readFile(target);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
