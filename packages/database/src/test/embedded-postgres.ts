import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import EmbeddedPostgres from "embedded-postgres";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const { port } = address;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Could not determine a free TCP port"));
      }
    });
  });
}

export interface EphemeralDatabase {
  databaseUrl: string;
  stop: () => Promise<void>;
}

/**
 * Starts a throwaway, non-service Postgres instance — no Docker, no system
 * install, no admin rights — for integration tests. Bound to a random free
 * port and wiped on `stop()`. This exists because this build environment
 * has no Docker Desktop and no system Postgres; see ARCHITECTURE.md §7.
 * Real developer machines and CI use Docker Compose / a services: postgres
 * container instead — this is a test-only fallback, not the documented
 * local-dev path.
 */
export async function startEphemeralDatabase(
  databaseName = "contentforge_test",
): Promise<EphemeralDatabase> {
  const port = await getFreePort();
  const databaseDir = mkdtempSync(join(tmpdir(), "contentforge-pg-"));

  const pg = new EmbeddedPostgres({
    databaseDir,
    user: "contentforge",
    password: "contentforge",
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(databaseName);

  const databaseUrl = `postgresql://contentforge:contentforge@127.0.0.1:${port}/${databaseName}?schema=public`;

  execSync("pnpm exec prisma migrate deploy", {
    cwd: packageRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });

  return {
    databaseUrl,
    stop: async () => {
      await pg.stop();
      rmSync(databaseDir, { recursive: true, force: true });
    },
  };
}

export interface PersistentDevDatabase {
  databaseUrl: string;
  stop: () => Promise<void>;
}

/**
 * Starts (or reuses) a persistent local Postgres instance for contributors
 * without Docker Desktop. Data survives restarts under
 * `.embedded-postgres-data/` (gitignored). NOT the documented primary
 * local-dev path — see docs/local-development.md — but a fully supported,
 * zero-admin-rights fallback used to verify this build in a sandbox with no
 * Docker available.
 */
export async function startPersistentDevDatabase(options?: {
  port?: number;
  databaseDir?: string;
}): Promise<PersistentDevDatabase> {
  const port = options?.port ?? 55432;
  const databaseDir = options?.databaseDir ?? join(packageRoot, ".embedded-postgres-data");
  const alreadyInitialised = existsSync(join(databaseDir, "PG_VERSION"));
  mkdirSync(databaseDir, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir,
    user: "contentforge",
    password: "contentforge",
    port,
    persistent: true,
  });

  if (!alreadyInitialised) {
    await pg.initialise();
  }
  await pg.start();
  if (!alreadyInitialised) {
    await pg.createDatabase("contentforge_dev");
  }

  const databaseUrl = `postgresql://contentforge:contentforge@127.0.0.1:${port}/contentforge_dev?schema=public`;
  return { databaseUrl, stop: () => pg.stop() };
}
