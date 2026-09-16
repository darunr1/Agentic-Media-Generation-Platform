import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { startEphemeralDatabase } from "../src/test/embedded-postgres";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(import.meta.url);
const webRequire = createRequire(resolve(root, "apps/web/package.json"));
const children: ChildProcess[] = [];
const db = await startEphemeralDatabase();
const storage = await mkdtemp(resolve(tmpdir(), "contentforge-e2e-media-"));
const env = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_URL: db.databaseUrl,
  APP_URL: "http://127.0.0.1:3100",
  AUTH_URL: "http://127.0.0.1:3100",
  NEXTAUTH_URL: "http://127.0.0.1:3100",
  AUTH_SECRET: "e2e-only-secret-not-for-production-123456",
  ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
  AI_TEXT_PROVIDER: "mock",
  AI_IMAGE_PROVIDER: "mock",
  AI_TTS_PROVIDER: "mock",
  SOCIAL_MOCK: "true",
  STORAGE_PROVIDER: "local",
  QUEUE_PROVIDER: "postgres",
  LOCAL_STORAGE_DIR: storage,
  WORKER_PORT: "3101",
  RENDERER_PORT: "3102",
};
function launch(args: string[], cwd = root) {
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: "inherit" });
  children.push(child);
  return child;
}
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  await Promise.all(
    children
      .filter((c) => c.exitCode === null)
      .map(
        (c) =>
          new Promise<void>((done) => {
            c.once("exit", () => done());
            setTimeout(() => {
              c.kill("SIGKILL");
              done();
            }, 5000).unref();
          }),
      ),
  );
  await db.stop();
  if (storage.startsWith(resolve(tmpdir(), "contentforge-e2e-media-")))
    await rm(storage, { recursive: true, force: true });
}
process.once("SIGTERM", () => void stop());
process.once("SIGINT", () => void stop());

try {
  const seed = launch([
    "--import",
    pathToFileURL(require.resolve("tsx")).href,
    resolve(root, "packages/database/prisma/seed.ts"),
  ]);
  await new Promise<void>((done, reject) => {
    seed.once("error", reject);
    seed.once("exit", (code) => (code === 0 ? done() : reject(new Error("E2E seed failed"))));
  });
  launch([
    "--import",
    pathToFileURL(require.resolve("tsx")).href,
    resolve(root, "apps/worker/src/index.ts"),
  ]);
  launch([
    "--import",
    pathToFileURL(require.resolve("tsx")).href,
    resolve(root, "apps/renderer/src/index.ts"),
  ]);
  launch(
    [webRequire.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3100"],
    resolve(root, "apps/web"),
  );
} catch (error) {
  await stop();
  throw error;
}
