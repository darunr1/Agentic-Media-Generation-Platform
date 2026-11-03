import { startEphemeralDatabase } from "./embedded-postgres";
import type { EphemeralDatabase } from "./embedded-postgres";

let db: EphemeralDatabase | undefined;

// embedded-postgres installs an async exit hook that calls process.exit(0).
// Preserve Vitest's failure code after database cleanup instead of reporting
// failed integration tests as successful CI steps.
process.prependOnceListener("beforeExit", (code) => {
  if (code !== 0)
    process.once("exit", () => {
      process.exitCode = code;
    });
});

export async function setup(): Promise<void> {
  db = await startEphemeralDatabase();
  process.env.DATABASE_URL = db.databaseUrl;
}

export async function teardown(): Promise<void> {
  await db?.stop();
}
