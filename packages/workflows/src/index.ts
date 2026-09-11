export const CONTENT_STATES = [
  "DRAFT",
  "PLANNING",
  "SCRIPTING",
  "ASSET_GENERATION",
  "VOICE_GENERATION",
  "CAPTION_GENERATION",
  "RENDERING",
  "AWAITING_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "PARTIALLY_PUBLISHED",
  "FAILED",
  "CANCELLED",
] as const;
export type ContentWorkflowState = (typeof CONTENT_STATES)[number];
const TRANSITIONS: Record<ContentWorkflowState, readonly ContentWorkflowState[]> = {
  DRAFT: ["PLANNING", "CANCELLED"],
  PLANNING: ["SCRIPTING", "FAILED", "CANCELLED"],
  SCRIPTING: ["ASSET_GENERATION", "FAILED", "CANCELLED"],
  ASSET_GENERATION: ["VOICE_GENERATION", "FAILED", "CANCELLED"],
  VOICE_GENERATION: ["CAPTION_GENERATION", "FAILED", "CANCELLED"],
  CAPTION_GENERATION: ["RENDERING", "FAILED", "CANCELLED"],
  RENDERING: ["AWAITING_REVIEW", "FAILED", "CANCELLED"],
  AWAITING_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "CANCELLED"],
  CHANGES_REQUESTED: ["SCRIPTING", "AWAITING_REVIEW", "CANCELLED"],
  APPROVED: ["SCHEDULED", "PUBLISHING", "CANCELLED"],
  SCHEDULED: ["PUBLISHING", "CANCELLED"],
  PUBLISHING: ["PUBLISHED", "PARTIALLY_PUBLISHED", "FAILED"],
  PUBLISHED: [],
  PARTIALLY_PUBLISHED: ["PUBLISHING"],
  FAILED: [
    "PLANNING",
    "SCRIPTING",
    "ASSET_GENERATION",
    "VOICE_GENERATION",
    "CAPTION_GENERATION",
    "RENDERING",
    "PUBLISHING",
    "CANCELLED",
  ],
  CANCELLED: [],
};
export function canTransition(from: ContentWorkflowState, to: ContentWorkflowState): boolean {
  return TRANSITIONS[from].includes(to);
}
export function assertTransition(from: ContentWorkflowState, to: ContentWorkflowState): void {
  if (!canTransition(from, to)) throw new Error(`Invalid workflow transition: ${from} -> ${to}`);
}

export interface QueueTask<T = unknown> {
  id: string;
  type: string;
  payload: T;
  idempotencyKey: string;
  scheduledAt: Date;
  attempt: number;
  maxAttempts: number;
}
export interface TaskQueueProvider {
  readonly name: string;
  enqueue<T>(task: QueueTask<T>): Promise<void>;
  reserve(): Promise<QueueTask | null>;
  acknowledge(id: string): Promise<void>;
  retry(id: string, scheduledAt: Date): Promise<void>;
  deadLetter(id: string, reason: string): Promise<void>;
  healthCheck(): Promise<boolean>;
}
export class LocalTaskQueueProvider implements TaskQueueProvider {
  readonly name = "local-memory";
  private readonly queue = new Map<string, QueueTask>();
  private readonly completed = new Set<string>();
  private readonly dead = new Map<string, string>();
  async enqueue<T>(task: QueueTask<T>) {
    if (
      this.completed.has(task.idempotencyKey) ||
      [...this.queue.values()].some((item) => item.idempotencyKey === task.idempotencyKey)
    )
      return;
    this.queue.set(task.id, task);
  }
  async reserve() {
    const task = [...this.queue.values()]
      .filter((item) => item.scheduledAt <= new Date())
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];
    return task ?? null;
  }
  async acknowledge(id: string) {
    const task = this.queue.get(id);
    if (task) this.completed.add(task.idempotencyKey);
    this.queue.delete(id);
  }
  async retry(id: string, scheduledAt: Date) {
    const task = this.queue.get(id);
    if (task) this.queue.set(id, { ...task, attempt: task.attempt + 1, scheduledAt });
  }
  async deadLetter(id: string, reason: string) {
    this.queue.delete(id);
    this.dead.set(id, reason);
  }
  async healthCheck() {
    return true;
  }
}
export function retryDelayMs(
  attempt: number,
  baseMs = 500,
  maximumMs = 60_000,
  random = Math.random,
): number {
  const exponential = Math.min(maximumMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.round(exponential * (0.75 + random() * 0.5));
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt?: number;
  constructor(
    private readonly threshold = 5,
    private readonly resetAfterMs = 30_000,
  ) {}
  canExecute(now = Date.now()): boolean {
    if (!this.openedAt) return true;
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
    return this.openedAt ? "OPEN" : "CLOSED";
  }
}
