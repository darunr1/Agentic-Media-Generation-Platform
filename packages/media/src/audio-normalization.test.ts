import { spawnSync } from "node:child_process";

import ffmpegPath from "ffmpeg-static";
import { describe, expect, it } from "vitest";

import { prepareSpeechAudioForRender } from "./audio-normalization";

function sampleWav(): Buffer {
  const sampleRate = 16_000;
  const frames = sampleRate / 10;
  const bytes = Buffer.alloc(44 + frames * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++)
    bytes.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 1000),
      44 + i * 2,
    );
  return bytes;
}

function expectRenderReadyWav(bytes: Uint8Array): void {
  const wav = Buffer.from(bytes);
  expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
  expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
  expect(wav.readUInt32LE(4)).toBe(wav.byteLength - 8);
  expect(wav.readUInt16LE(20)).toBe(1); // PCM
  expect(wav.readUInt16LE(22)).toBe(1); // mono
  expect(wav.readUInt32LE(24)).toBe(48_000);
  expect(wav.readUInt16LE(34)).toBe(16);
  expect(wav.byteLength).toBeGreaterThan(44);
}

describe("speech audio preparation", () => {
  it("normalizes an OpenAI-compatible WAV sample without mutating it", async () => {
    const sample = sampleWav();
    const original = Buffer.from(sample);
    const prepared = await prepareSpeechAudioForRender({ bytes: sample, mimeType: "audio/wav" });
    expectRenderReadyWav(prepared);
    expect(prepared.byteLength).toBeGreaterThan(sample.byteLength);
    expect(sample).toEqual(original);
  });

  it("converts compressed MP3 speech into the same WAV render format", async () => {
    const mp3Args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "wav",
      "-i",
      "pipe:0",
      "-f",
      "mp3",
      "pipe:1",
    ];
    const encoded = spawnSync(process.env.FFMPEG_PATH ?? ffmpegPath ?? "ffmpeg", mp3Args, {
      input: sampleWav(),
      maxBuffer: 1024 * 1024,
    });
    expect(encoded.status).toBe(0);
    expect(encoded.stdout.byteLength).toBeGreaterThan(0);
    const prepared = await prepareSpeechAudioForRender({
      bytes: encoded.stdout,
      mimeType: "audio/mpeg",
    });
    expectRenderReadyWav(prepared);
  });

  it("rejects unsupported content types and empty audio", async () => {
    await expect(
      prepareSpeechAudioForRender({ bytes: sampleWav(), mimeType: "image/png" }),
    ).rejects.toThrow("Unsupported speech audio format");
    await expect(
      prepareSpeechAudioForRender({ bytes: new Uint8Array(), mimeType: "audio/wav" }),
    ).rejects.toThrow("Invalid speech audio size");
  });

  it("rejects excessively large input before invoking FFmpeg", async () => {
    await expect(
      prepareSpeechAudioForRender({
        bytes: new Uint8Array(25 * 1024 * 1024 + 1),
        mimeType: "audio/wav",
      }),
    ).rejects.toThrow("Invalid speech audio size");
  });

  it("rejects corrupt WAV data instead of returning an unrenderable audio track", async () => {
    await expect(
      prepareSpeechAudioForRender({ bytes: Buffer.from("not a wav"), mimeType: "audio/wav" }),
    ).rejects.toThrow("Failed to normalize speech audio for rendering");
  });

  it("honors cancellation before starting normalization", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      prepareSpeechAudioForRender({ bytes: sampleWav(), mimeType: "audio/wav" }, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
