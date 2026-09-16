import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

import type {
  BinaryGenerationRequest,
  ImageGenerationProvider,
  TextToSpeechProvider,
  ProviderResult,
  GeneratedMedia,
} from "../types";

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const header = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([header, body, crc]);
}
export class MockImageGenerationProvider implements ImageGenerationProvider {
  readonly name = "mock";
  validateConfiguration() {}
  async healthCheck() {
    return { status: "healthy" as const, checkedAt: new Date() };
  }
  async generateImage(request: BinaryGenerationRequest): Promise<ProviderResult<GeneratedMedia>> {
    request.signal?.throwIfAborted();
    const width = request.width ?? 360,
      height = request.height ?? 640;
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 2048 ||
      height > 2048
    )
      throw new Error("Invalid image dimensions");
    const color = createHash("sha256").update(request.prompt).digest();
    const raw = Buffer.alloc((width * 3 + 1) * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        for (let c = 0; c < 3; c++)
          raw[y * (width * 3 + 1) + 1 + x * 3 + c] = Math.round(
            (color[c] ?? 100) * (0.25 + (0.65 * y) / height),
          );
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    const bytes = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]);
    return {
      data: { bytes, mimeType: "image/png", width, height },
      usage: {
        provider: "mock",
        model: "deterministic-gradient-v1",
        durationMs: 0,
        costCents: 0,
        mediaCount: 1,
        costKnown: true,
      },
    };
  }
}
/** A playable reference tone, explicitly not synthesized human speech. */
export class MockTextToSpeechProvider implements TextToSpeechProvider {
  readonly name = "mock";
  validateConfiguration() {}
  async healthCheck() {
    return { status: "healthy" as const, checkedAt: new Date() };
  }
  async synthesize(input: {
    text: string;
    voice: string;
    idempotencyKey: string;
    durationSeconds?: number;
  }): Promise<ProviderResult<GeneratedMedia>> {
    const durationSeconds = Math.min(
      60,
      Math.max(1, input.durationSeconds ?? input.text.split(/\s+/).length / 2.5),
    );
    const sampleRate = 16000,
      count = Math.round(durationSeconds * sampleRate),
      bytes = Buffer.alloc(44 + count * 2);
    bytes.write("RIFF");
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
    bytes.writeUInt32LE(count * 2, 40);
    for (let i = 0; i < count; i++)
      bytes.writeInt16LE(
        Math.round(Math.sin((i * 2 * Math.PI * 220) / sampleRate) * 500),
        44 + i * 2,
      );
    return {
      data: { bytes, mimeType: "audio/wav", durationSeconds },
      usage: {
        provider: "mock",
        model: "reference-tone-v1",
        durationMs: 0,
        costCents: 0,
        mediaCount: 1,
        costKnown: true,
      },
    };
  }
}
