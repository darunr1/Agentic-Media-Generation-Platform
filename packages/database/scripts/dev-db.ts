/**
 * No-Docker fallback for running Postgres locally. See
 * docs/local-development.md — Docker Compose is the documented, primary
 * path; this is for contributors (or sandboxes) without Docker Desktop.
 *
 *   pnpm --filter @contentforge/database dev:db
 *
 * Prints the DATABASE_URL to put in .env, then stays running until Ctrl+C.
 */
import { startPersistentDevDatabase } from "../src/test/embedded-postgres";

async function main() {
  const { databaseUrl, stop } = await startPersistentDevDatabase();
  console.log("\nLocal embedded Postgres is running (no Docker required).");
  console.log(`DATABASE_URL=${databaseUrl}`);
  console.log("\nPress Ctrl+C to stop.\n");

  const shutdown = async () => {
    console.log("\nStopping embedded Postgres...");
    await stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
