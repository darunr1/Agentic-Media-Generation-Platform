import { RateLimitedError } from "@contentforge/shared";
interface Entry {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Entry>();
export function enforceRateLimit(key: string, limit = 120, windowMs = 60_000, now = Date.now()) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit)
    throw new RateLimitedError(Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
  current.count += 1;
  if (buckets.size > 10_000)
    for (const [entryKey, entry] of buckets) if (entry.resetAt <= now) buckets.delete(entryKey);
}
