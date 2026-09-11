import { startEphemeralDatabase } from "./embedded-postgres";
import type { EphemeralDatabase } from "./embedded-postgres";

let db: EphemeralDatabase | undefined;

export async function setup(): Promise<void> {
  db = await startEphemeralDatabase();
  process.env.DATABASE_URL = db.databaseUrl;
}

export async function teardown(): Promise<void> {
  await db?.stop();
}
