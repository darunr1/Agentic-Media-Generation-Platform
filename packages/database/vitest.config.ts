import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts", "node_modules/**"],
    // This package is schema/client only in Phase 1 — no pure functions to
    // unit test yet. Real coverage lives in the embedded-postgres
    // integration suite (`pnpm test:integration`) and in apps/web's service
    // tests, which exercise this package's Prisma client against a real
    // database.
    passWithNoTests: true,
  },
});
