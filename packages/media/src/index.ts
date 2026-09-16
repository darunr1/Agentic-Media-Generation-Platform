import { spawn } from "node:child_process";
import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";

import ffmpegPath from "ffmpeg-static";

export interface StorageObject {
  key: string;
  sizeBytes: number;
  contentType: string;
  checksumSha256: string;
}
export interface ObjectStorageProvider {
  readonly name: string;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<StorageObject>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  createSignedUploadUrl(key: string, expiresInSeconds: number): Promise<string>;
  createSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}

function safeKey(key: string): string {
  const normalized = normalize(key).replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("\0"))
    throw new Error("Unsafe storage key");
  return normalized;
}

export class LocalObjectStorageProvider implements ObjectStorageProvider {
  readonly name = "local";
  constructor(
    private readonly root: string,
    private readonly publicBaseUrl = "/api/storage",
  ) {}
  private path(key: string): string {
    const root = resolve(this.root);
    const target = resolve(root, safeKey(key));
    if (!target.startsWith(`${root}${sep}`) && target !== root)
      throw new Error("Storage path escaped root");
    return target;
  }
  async put(key: string, bytes: Uint8Array, contentType: string): Promise<StorageObject> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, bytes);
    await rename(temp, target);
    return {
      key: safeKey(key),
      sizeBytes: bytes.byteLength,
      contentType,
      checksumSha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  async get(key: string): Promise<Uint8Array> {
    return readFile(this.path(key));
  }
  async delete(key: string): Promise<void> {
    const { unlink } = await import("node:fs/promises");
    await unlink(this.path(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  async createSignedUploadUrl(_key: string, _expiresInSeconds: number): Promise<string> {
    throw new Error("Setup required: local browser uploads are not implemented");
  }
  async createSignedDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return this.signedUrl(key, expiresInSeconds, "GET");
  }
  private signedUrl(key: string, seconds: number, method: string) {
    const expires = Date.now() + Math.min(3600, Math.max(1, seconds)) * 1000;
    const normalized = safeKey(key);
    const signature = signStorageKey(normalized, expires, method);
    return `${this.publicBaseUrl}?key=${encodeURIComponent(normalized)}&expires=${expires}&signature=${signature}`;
  }
  async healthCheck() {
    try {
      await mkdir(this.root, { recursive: true });
      await stat(this.root);
      return { healthy: true };
    } catch {
      return { healthy: false, message: "Local storage is unavailable" };
    }
  }
}

export const MEDIA_LIMITS = {
  imageBytes: 15 * 1024 * 1024,
  videoBytes: 500 * 1024 * 1024,
  documentBytes: 10 * 1024 * 1024,
} as const;
const MAGIC: Array<{ mime: string; signature: number[] }> = [
  { mime: "image/png", signature: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  { mime: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },
  { mime: "video/mp4", signature: [0x66, 0x74, 0x79, 0x70] },
];
export function detectMediaType(bytes: Uint8Array): string | null {
  for (const item of MAGIC) {
    const offset = item.mime === "video/mp4" ? 4 : 0;
    if (item.signature.every((byte, index) => bytes[offset + index] === byte)) return item.mime;
  }
  return null;
}
export function sanitizeFilename(name: string): string {
  return (
    name
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "upload"
  );
}

export interface CaptionCue {
  startSeconds: number;
  endSeconds: number;
  text: string;
}
function timestamp(seconds: number, separator: "," | "."): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${separator}${String(ms % 1000).padStart(3, "0")}`;
}
export function toSrt(cues: CaptionCue[]): string {
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${timestamp(cue.startSeconds, ",")} --> ${timestamp(cue.endSeconds, ",")}\n${cue.text.replace(/[<>]/g, "")}\n`,
    )
    .join("\n");
}
export function toWebVtt(cues: CaptionCue[]): string {
  return `WEBVTT\n\n${cues.map((cue) => `${timestamp(cue.startSeconds, ".")} --> ${timestamp(cue.endSeconds, ".")}\n${cue.text.replace(/[<>]/g, "")}\n`).join("\n")}`;
}

export const RENDER_TEMPLATES = [
  {
    key: "educational-list",
    name: "Educational list",
    description: "Numbered teaching beats with animated type",
  },
  {
    key: "myth-fact",
    name: "Myth versus fact",
    description: "High-contrast claim and reveal structure",
  },
  {
    key: "promotional-offer",
    name: "Promotional offer",
    description: "Product-led story with restrained CTA",
  },
] as const;

export interface RenderRequest {
  outputPath: string;
  width: number;
  height: number;
  durationSeconds: number;
  title: string;
  subtitle: string;
  primaryColor: string;
  accentColor: string;
  timeoutMs?: number;
}
export interface RenderResult {
  outputPath: string;
  durationMs: number;
  sizeBytes: number;
  costCents: number;
}
function ffmpegEscape(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "’")
    .replaceAll("%", "\\%");
}
export async function renderGradientVideo(
  request: RenderRequest,
  signal?: AbortSignal,
): Promise<RenderResult> {
  if (
    request.width < 320 ||
    request.height < 320 ||
    request.durationSeconds < 1 ||
    request.durationSeconds > 300
  )
    throw new Error("Invalid render dimensions or duration");
  await mkdir(dirname(request.outputPath), { recursive: true });
  const started = Date.now();
  const filter = `drawbox=x=0:y=0:w=iw:h=ih:color=${request.primaryColor}@1:t=fill,drawbox=x='mod(t*80,iw)-iw/2':y=0:w=iw/2:h=ih:color=${request.accentColor}@0.32:t=fill,drawtext=text='${ffmpegEscape(request.title)}':fontcolor=white:fontsize=h/14:x=(w-text_w)/2:y=h*0.37:box=1:boxcolor=black@0.25:boxborderw=28,drawtext=text='${ffmpegEscape(request.subtitle)}':fontcolor=white@0.85:fontsize=h/28:x=(w-text_w)/2:y=h*0.58`;
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${request.primaryColor}:s=${request.width}x${request.height}:d=${request.durationSeconds}:r=30`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=220:sample_rate=48000:duration=${request.durationSeconds}`,
    "-vf",
    filter,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-filter:a",
    "volume=0.025,loudnorm",
    "-movflags",
    "+faststart",
    request.outputPath,
  ];
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(process.env.FFMPEG_PATH ?? ffmpegPath ?? "ffmpeg", args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Render timed out"));
    }, request.timeoutMs ?? 120_000);
    const abort = () => {
      child.kill();
      reject(new Error("Render cancelled"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-4000);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      if (code === 0) resolvePromise();
      else reject(new Error(`FFmpeg exited ${code}: ${stderr}`));
    });
  });
  const output = await stat(request.outputPath);
  return {
    outputPath: request.outputPath,
    durationMs: Date.now() - started,
    sizeBytes: output.size,
    costCents: 0,
  };
}

export function storagePath(root: string, ...parts: string[]): string {
  return join(root, ...parts.map(safeKey));
}

function signStorageKey(key: string, expires: number, method: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Storage signing requires AUTH_SECRET");
  return createHmac("sha256", secret).update(`${method}\n${key}\n${expires}`).digest("hex");
}
export function verifyStorageSignature(
  key: string,
  expires: number,
  signature: string,
  method = "GET",
) {
  if (
    !Number.isFinite(expires) ||
    expires < Date.now() ||
    expires > Date.now() + 3_600_000 ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  try {
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(signStorageKey(safeKey(key), expires, method), "hex"),
    );
  } catch {
    return false;
  }
}
export * from "./scene-renderer";
