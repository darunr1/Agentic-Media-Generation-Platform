export function retryDelayMs(
  attempt: number,
  baseMs = 500,
  maximumMs = 60_000,
  random = Math.random,
): number {
  const exponential = Math.min(maximumMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.min(maximumMs, Math.round(exponential * (0.75 + random() * 0.5)));
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt?: number;
  constructor(
    private readonly threshold = 5,
    private readonly resetAfterMs = 30_000,
  ) {}
  canExecute(now = Date.now()): boolean {
    if (this.openedAt === undefined) return true;
    if (now - this.openedAt >= this.resetAfterMs) {
      this.failures = 0;
      this.openedAt = undefined;
      return true;
    }
    return false;
  }
  success() {
    this.failures = 0;
    this.openedAt = undefined;
  }
  failure(now = Date.now()) {
    this.failures += 1;
    if (this.failures >= this.threshold) this.openedAt = now;
  }
  get state(): "CLOSED" | "OPEN" {
    return this.openedAt !== undefined ? "OPEN" : "CLOSED";
  }
}
