import { spawnSync } from "node:child_process";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ffmpegPath from "ffmpeg-static";
import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareSpeechAudioForRender } from "./audio-normalization";
import { renderScenes } from "./scene-renderer";

const fileHooks = vi.hoisted(() => ({
  createdDirectories: [] as string[],
  voiceReadPaths: [] as string[],
  voiceReadSignals: [] as Array<AbortSignal | undefined>,
  afterVoiceRead: undefined as undefined | (() => void),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    mkdtemp: async (prefix: string) => {
      const dir = await actual.mkdtemp(prefix);
      if (prefix.endsWith("contentforge-audio-")) fileHooks.createdDirectories.push(dir);
      return dir;
    },
    readFile: async (path: string, options?: { signal?: AbortSignal }) => {
      const bytes = await actual.readFile(path, options);
      if (path.endsWith("voice.wav")) {
        fileHooks.voiceReadPaths.push(path);
        fileHooks.voiceReadSignals.push(options?.signal);
        fileHooks.afterVoiceRead?.();
      }
      return bytes;
    },
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  fileHooks.afterVoiceRead = undefined;
  fileHooks.createdDirectories.length = 0;
  fileHooks.voiceReadPaths.length = 0;
  fileHooks.voiceReadSignals.length = 0;
});

async function expectAudioTempCleaned(): Promise<void> {
  expect(fileHooks.createdDirectories.length).toBeGreaterThan(0);
  for (const dir of fileHooks.createdDirectories) {
    await expect(stat(dir)).rejects.toMatchObject({ code: "ENOENT" });
  }
}

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
  expect(wav.readUInt16LE(20)).toBe(1);
  expect(wav.readUInt16LE(22)).toBe(1);
  expect(wav.readUInt32LE(24)).toBe(48_000);
  expect(wav.readUInt16LE(34)).toBe(16);
  expect(wav.byteLength).toBeGreaterThan(44);
}

describe("speech audio preparation", () => {
  it("normalizes a WAV sample without mutation and cleans up temp files", async () => {
    const sample = sampleWav();
    const original = Buffer.from(sample);
    const prepared = await prepareSpeechAudioForRender({ bytes: sample, mimeType: "audio/wav" });
    expectRenderReadyWav(prepared);
    expect(prepared.byteLength).toBeGreaterThan(sample.byteLength);
    expect(sample).toEqual(original);
    await expectAudioTempCleaned();
  });

  it("accepts audio/x-wav and produces render-ready PCM", async () => {
    const prepared = await prepareSpeechAudioForRender({
      bytes: sampleWav(),
      mimeType: "audio/x-wav",
    });
    expectRenderReadyWav(prepared);
    await expectAudioTempCleaned();
  });

  it("converts compressed MP3 speech into the same WAV render format", async () => {
    const encoded = spawnSync(
      process.env.FFMPEG_PATH ?? ffmpegPath ?? "ffmpeg",
      [
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
      ],
      { input: sampleWav(), maxBuffer: 1024 * 1024 },
    );
    expect(encoded.status).toBe(0);
    expect(encoded.stdout.byteLength).toBeGreaterThan(0);
    const prepared = await prepareSpeechAudioForRender({
      bytes: encoded.stdout,
      mimeType: "audio/mpeg",
    });
    expectRenderReadyWav(prepared);
    await expectAudioTempCleaned();
  });

  it("rejects highly compressed overlength MP3 before reading the decoded WAV", async () => {
    const encoded = spawnSync(
      process.env.FFMPEG_PATH ?? ffmpegPath ?? "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=8000:cl=mono",
        "-t",
        "63",
        "-b:a",
        "16k",
        "-f",
        "mp3",
        "pipe:1",
      ],
      { maxBuffer: 1024 * 1024, timeout: 30_000 },
    );
    expect(encoded.status).toBe(0);
    expect(encoded.stdout.byteLength).toBeGreaterThan(0);
    expect(encoded.stdout.byteLength).toBeLessThan(200_000);
    await expect(
      prepareSpeechAudioForRender({ bytes: encoded.stdout, mimeType: "audio/mpeg" }),
    ).rejects.toThrow("Speech audio exceeds render duration limit");
    expect(fileHooks.voiceReadPaths).toEqual([]);
    await expectAudioTempCleaned();
  }, 30_000);

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

  it("rejects corrupt WAV and MP3 and cleans up temp files", async () => {
    await expect(
      prepareSpeechAudioForRender({ bytes: Buffer.from("not a wav"), mimeType: "audio/wav" }),
    ).rejects.toThrow("Failed to normalize speech audio for rendering");
    await expect(
      prepareSpeechAudioForRender({ bytes: Buffer.from("not an mp3"), mimeType: "audio/mpeg" }),
    ).rejects.toThrow("Failed to normalize speech audio for rendering");
    await expectAudioTempCleaned();
  });

  it("honors cancellation before starting normalization", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      prepareSpeechAudioForRender({ bytes: sampleWav(), mimeType: "audio/wav" }, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it.skipIf(process.platform === "win32")(
    "cancels an in-flight FFmpeg process and cleans up temporary files",
    async () => {
      const fixture = await mkdtemp(join(tmpdir(), "audio-cancel-fixture-"));
      const executable = join(fixture, "stall-ffmpeg");
      const ready = join(fixture, "ready");
      const controller = new AbortController();
      try {
        await writeFile(
          executable,
          '#!/bin/sh\nprintf ready > "$AUDIO_TEST_READY"\nexec sleep 30\n',
          { mode: 0o755 },
        );
        vi.stubEnv("FFMPEG_PATH", executable);
        vi.stubEnv("AUDIO_TEST_READY", ready);
        const conversion = prepareSpeechAudioForRender(
          { bytes: sampleWav(), mimeType: "audio/wav" },
          controller.signal,
        );
        await vi.waitFor(async () => {
          await stat(ready);
        }, { timeout: 10_000, interval: 20 });
        controller.abort();
        await expect(conversion).rejects.toMatchObject({ name: "AbortError" });
        await expectAudioTempCleaned();
      } finally {
        controller.abort();
        await rm(fixture, { recursive: true, force: true });
      }
    },
    15_000,
  );

  it("rejects cancellation at the final read/return boundary and cleans up", async () => {
    const controller = new AbortController();
    fileHooks.afterVoiceRead = () => controller.abort();
    await expect(
      prepareSpeechAudioForRender({ bytes: sampleWav(), mimeType: "audio/wav" }, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fileHooks.voiceReadPaths).toHaveLength(1);
    expect(fileHooks.voiceReadSignals[0]).toBe(controller.signal);
    await expectAudioTempCleaned();
  });

  it("renders normalized speech with renderScenes into a valid MP4", async () => {
    const audio = await prepareSpeechAudioForRender({
      bytes: sampleWav(),
      mimeType: "audio/wav",
    });
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGOUi1rAwMDAxMDAwMDAAAAMyAEcmM2rsQAAAABJRU5ErkJggg==",
      "base64",
    );
    const rendered = await renderScenes({
      scenes: [{ bytes: png, durationSeconds: 1, text: "Test", caption: "Speech" }],
      audio,
      width: 360,
      height: 640,
    });
    expect(Buffer.from(rendered.bytes).toString("ascii", 4, 8)).toBe("ftyp");
    expect(rendered.sizeBytes).toBeGreaterThan(0);
    await expectAudioTempCleaned();
  }, 30_000);
});
