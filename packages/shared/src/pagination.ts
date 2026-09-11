import { z } from "zod";

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Standard cursor-pagination shape: fetch `limit + 1` rows ordered by `id`,
 * and if the extra row came back, there's a next page. Callers pass their
 * own Prisma `findMany` results in — this just applies the "fetch one extra"
 * convention consistently everywhere lists are paginated.
 */
export function paginate<T extends { id: string }>(rows: T[], limit: number): PaginatedResult<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;
  return { items, nextCursor, hasMore };
}
