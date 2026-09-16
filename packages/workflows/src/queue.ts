import { randomUUID } from "node:crypto";

export interface QueueTask<T = unknown> {
  id: string;
  workspaceId: string;
  workflowRunId?: string;
  type: string;
  payload: T;
  idempotencyKey: string;
  scheduledAt: Date;
  attempt: number;
  maxAttempts: number;
  reservationToken?: string;
}
export interface TaskQueueProvider {
  readonly name: string;
  enqueue<T>(task: QueueTask<T>): Promise<void>;
  reserve(types?: readonly string[]): Promise<QueueTask | null>;
  acknowledge(task: QueueTask): Promise<void>;
  retry(task: QueueTask, scheduledAt: Date, reason: string): Promise<void>;
  deadLetter(task: QueueTask, reason: string): Promise<void>;
  cancel(id: string, workspaceId: string): Promise<void>;
  heartbeat(task: QueueTask): Promise<boolean>;
  healthCheck(): Promise<boolean>;
}

/** Test-only queue, with the same reservation and fencing semantics as PostgreSQL. */
export class LocalTaskQueueProvider implements TaskQueueProvider {
  readonly name = "local-memory";
  readonly tasks = new Map<
    string,
    { task: QueueTask; status: string; lease: number; error?: string }
  >();
  constructor(private readonly leaseMs = 60_000) {}
  async enqueue<T>(task: QueueTask<T>) {
    if (
      [...this.tasks.values()].some(
        ({ task: t }) =>
          t.workspaceId === task.workspaceId && t.idempotencyKey === task.idempotencyKey,
      )
    )
      return;
    this.tasks.set(task.id, { task: structuredClone(task), status: "QUEUED", lease: 0 });
  }
  async reserve(types?: readonly string[]): Promise<QueueTask | null> {
    const row = [...this.tasks.values()]
      .sort((a, b) => a.task.scheduledAt.getTime() - b.task.scheduledAt.getTime())
      .find(
        (r) =>
          (!types || types.includes(r.task.type)) &&
          r.task.scheduledAt.getTime() <= Date.now() &&
          (["QUEUED", "RETRYING"].includes(r.status) ||
            (r.status === "RUNNING" && r.lease <= Date.now())),
      );
    if (!row) return null;
    if (row.task.attempt >= row.task.maxAttempts) {
      row.status = "DEAD_LETTER";
      return this.reserve(types);
    }
    row.status = "RUNNING";
    row.lease = Date.now() + this.leaseMs;
    row.task = { ...row.task, attempt: row.task.attempt + 1, reservationToken: randomUUID() };
    return structuredClone(row.task);
  }
  private owned(task: QueueTask) {
    const row = this.tasks.get(task.id);
    return row?.status === "RUNNING" &&
      row.lease > Date.now() &&
      row.task.reservationToken === task.reservationToken
      ? row
      : undefined;
  }
  async acknowledge(task: QueueTask) {
    const row = this.owned(task);
    if (row) row.status = "COMPLETED";
  }
  async retry(task: QueueTask, scheduledAt: Date, reason: string) {
    const row = this.owned(task);
    if (row) {
      row.status = "RETRYING";
      row.task.scheduledAt = scheduledAt;
      row.error = reason;
    }
  }
  async deadLetter(task: QueueTask, reason: string) {
    const row = this.owned(task);
    if (row) {
      row.status = "DEAD_LETTER";
      row.error = reason;
    }
  }
  async cancel(id: string, workspaceId: string) {
    const row = this.tasks.get(id);
    if (
      row?.task.workspaceId === workspaceId &&
      ["QUEUED", "RUNNING", "RETRYING"].includes(row.status)
    )
      row.status = "CANCELLED";
  }
  async heartbeat(task: QueueTask) {
    const row = this.owned(task);
    if (!row) return false;
    row.lease = Date.now() + this.leaseMs;
    return true;
  }
  async healthCheck() {
    return true;
  }
}
