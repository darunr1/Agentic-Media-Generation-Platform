import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_RENDER_AUDIO_SECONDS = 60;
const MAX_DECODE_AUDIO_SECONDS = MAX_RENDER_AUDIO_SECONDS + 1;
const AUDIO_SAMPLE_RATE_HZ = 48_000;
const AUDIO_CHANNELS = 1;
const PCM_BYTES_PER_SAMPLE = 2;
const WAV_HEADER_SLACK_BYTES = 4 * 1024;
const MAX_WAV_OUTPUT_BYTES =
  MAX_RENDER_AUDIO_SECONDS * AUDIO_SAMPLE_RATE_HZ * AUDIO_CHANNELS * PCM_BYTES_PER_SAMPLE +
  WAV_HEADER_SLACK_BYTES;

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
          String(AUDIO_CHANNELS),
          "-ar",
          String(AUDIO_SAMPLE_RATE_HZ),
          "-c:a",
          "pcm_s16le",
          "-t",
          String(MAX_DECODE_AUDIO_SECONDS),
          target,
        ],
        { windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024, signal },
      );
    } catch (error) {
      signal?.throwIfAborted();
      throw new Error("Failed to normalize speech audio for rendering", { cause: error });
    }

    // Inspect the on-disk size before allocating a Buffer for decoded PCM.
    const { size } = await stat(target);
    if (size > MAX_WAV_OUTPUT_BYTES) throw new Error("Speech audio exceeds render duration limit");

    const bytes = await readFile(target, { signal });
    signal?.throwIfAborted();
    return bytes;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
