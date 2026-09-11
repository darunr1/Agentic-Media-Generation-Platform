import { createId, isCuid } from "@paralleldrive/cuid2";

/** Matches Prisma's `@default(cuid())` id strategy used across the schema. */
export function newId(): string {
  return createId();
}

export function isValidId(value: string): boolean {
  return isCuid(value);
}

/**
 * Deterministic idempotency key for a logical operation. Same inputs always
 * produce the same key so a retried request (network retry, double-click,
 * worker crash-restart) lands on the same DB row via a unique constraint
 * instead of creating a duplicate.
 */
export function deriveIdempotencyKey(...parts: Array<string | number | undefined | null>): string {
  return parts
    .filter((p): p is string | number => p !== undefined && p !== null && p !== "")
    .map(String)
    .join(":");
}

/** Random idempotency key for client-initiated mutations (e.g. an "Idempotency-Key" header). */
export function newIdempotencyKey(): string {
  return createId();
}
