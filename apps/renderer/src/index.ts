import { createServer } from "node:http";
import { resolve } from "node:path";

import { renderGradientVideo } from "@contentforge/media";
import { createLogger } from "@contentforge/shared";
import { z } from "zod";
const logger = createLogger({ name: "renderer" });
const schema = z.object({
  jobId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  width: z.number().int().min(320).max(3840),
  height: z.number().int().min(320).max(3840),
  durationSeconds: z.number().min(1).max(60),
  title: z.string().min(1).max(100),
  subtitle: z.string().max(180),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
const root = resolve(process.env.LOCAL_STORAGE_DIR ?? ".local-storage", "renders");
const server = createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.url === "/healthz" || req.url === "/readyz") {
    res.end(JSON.stringify({ status: "ok", service: "renderer", ffmpeg: "checked-per-job" }));
    return;
  }
  if (req.url !== "/render" || req.method !== "POST") {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not_found" }));
    return;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 16_384) {
      res.statusCode = 413;
      res.end(JSON.stringify({ error: "payload_too_large" }));
      return;
    }
  }
  try {
    const input = schema.parse(JSON.parse(raw) as unknown);
    const result = await renderGradientVideo({
      ...input,
      outputPath: resolve(root, `${input.jobId}.mp4`),
    });
    res.statusCode = 201;
    res.end(JSON.stringify({ data: result }));
  } catch (error) {
    logger.error({ err: error }, "Render failed");
    res.statusCode = 422;
    res.end(JSON.stringify({ error: "render_failed" }));
  }
});
const port = Number(process.env.RENDERER_PORT ?? 3002);
server.listen(port, "0.0.0.0", () => logger.info({ port }, "Renderer started"));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
