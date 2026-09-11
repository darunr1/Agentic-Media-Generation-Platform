import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient. In Next.js dev mode, modules can be re-evaluated
 * on every hot reload — stashing the client on `globalThis` prevents
 * exhausting the Postgres connection pool with a new client per reload.
 * apps/worker and apps/renderer each get their own process-lifetime
 * singleton, which is the correct behavior there too.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient } from "@prisma/client";
