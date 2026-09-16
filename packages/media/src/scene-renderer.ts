import { spawn } from "node:child_process";
import { mkdtemp, writeFile, stat, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import ffmpegPath from "ffmpeg-static";

export function localStorageRoot() {
  return resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../..",
    process.env.LOCAL_STORAGE_DIR ?? ".local-storage",
  );
}
export interface SceneRenderInput {
  scenes: Array<{ bytes: Uint8Array; durationSeconds: number; text: string; caption: string }>;
  audio: Uint8Array;
  width: number;
  height: number;
  timeoutMs?: number;
}
function wrap(text: string, length: number) {
  const words = text.replace(/[\r\n]+/g, " ").split(/\s+/);
  const lines = [""];
  for (const word of words) {
    if (lines.at(-1)!.length + word.length > length) lines.push("");
    lines[lines.length - 1] += `${word} `;
  }
  return lines.slice(0, 6).join("\n");
}
export async function renderScenes(
  input: SceneRenderInput,
  signal?: AbortSignal,
): Promise<{ bytes: Uint8Array; durationSeconds: number; sizeBytes: number }> {
  signal?.throwIfAborted();
  const durationSeconds = input.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (
    !input.scenes.length ||
    input.scenes.length > 20 ||
    durationSeconds > 60 ||
    input.scenes.some((s) => !Number.isFinite(s.durationSeconds) || s.durationSeconds <= 0) ||
    ![input.width, input.height].every(
      (n) => Number.isInteger(n) && n >= 320 && n <= 1920 && n % 2 === 0,
    )
  )
    throw new Error("Invalid scene render plan");
  const temp = await mkdtemp(join(tmpdir(), "contentforge-render-"));
  try {
    // Fixed local filenames avoid putting untrusted text/paths into FFmpeg filter expressions.
    const font =
      process.platform === "win32"
        ? "C:/Windows/Fonts/arial.ttf"
        : "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
    await copyFile(font, join(temp, "font.ttf"));
    const args: string[] = ["-y", "-threads", "2"];
    const filters: string[] = [];
    for (const [index, scene] of input.scenes.entries()) {
      await writeFile(join(temp, `scene${index}.png`), scene.bytes);
      await writeFile(join(temp, `title${index}.txt`), wrap(scene.text, 25));
      await writeFile(join(temp, `caption${index}.txt`), wrap(scene.caption, 36));
      args.push("-loop", "1", "-t", String(scene.durationSeconds), "-i", `scene${index}.png`);
      filters.push(
        `[${index}:v]scale=${input.width}:${input.height}:force_original_aspect_ratio=increase,crop=${input.width}:${input.height},setsar=1,fps=24,format=yuv420p,drawtext=fontfile=font.ttf:textfile=title${index}.txt:expansion=none:fontcolor=white:fontsize=24:x=(w-text_w)/2:y=h*0.25:box=1:boxcolor=black@0.4:boxborderw=10,drawtext=fontfile=font.ttf:textfile=caption${index}.txt:expansion=none:fontcolor=white:fontsize=16:x=(w-text_w)/2:y=h*0.70:box=1:boxcolor=black@0.65:boxborderw=8,setpts=PTS-STARTPTS[v${index}]`,
      );
    }
    await writeFile(join(temp, "voice.wav"), input.audio);
    args.push("-i", "voice.wav");
    filters.push(
      `${input.scenes.map((_, i) => `[v${i}]`).join("")}concat=n=${input.scenes.length}:v=1:a=0[out]`,
    );
    args.push(
      "-filter_complex_threads",
      "1",
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[out]",
      "-map",
      `${input.scenes.length}:a`,
      "-t",
      String(durationSeconds),
      "-c:v",
      "libx264",
      "-threads",
      "2",
      "-preset",
      "ultrafast",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      "output.mp4",
    );
    await new Promise<void>((resolvePromise, reject) => {
      const child = spawn(process.env.FFMPEG_PATH ?? ffmpegPath ?? "ffmpeg", args, {
        cwd: temp,
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
      });
      let cause: Error | undefined;
      const abort = () => {
        cause = new Error("Render cancelled");
        child.kill();
      };
      const timer = setTimeout(() => {
        cause = new Error("Render timed out");
        child.kill();
      }, input.timeoutMs ?? 120_000);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      child.stderr.resume();
      child.on("error", (error) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        if (cause || code !== 0) reject(cause ?? new Error(`FFmpeg failed (${code})`));
        else resolvePromise();
      });
    });
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile(join(temp, "output.mp4"));
    return { bytes, durationSeconds, sizeBytes: (await stat(join(temp, "output.mp4"))).size };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
