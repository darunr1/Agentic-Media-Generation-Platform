import { createLogger } from "@contentforge/shared";

import type { QueueTask, TaskQueueProvider } from "./queue";
import { retryDelayMs } from "./retry";

export class PermanentTaskError extends Error {
  readonly retryable = false;
}
export interface TaskHandler {
  execute(task: QueueTask, signal: AbortSignal): Promise<void>;
}
export type TaskRegistry = Readonly<Record<string, TaskHandler>>;
export type FailureObserver = (task: QueueTask, reason: string, retrying: boolean) => Promise<void>;

/** Logs only fixed categories: arbitrary provider exceptions can contain credentials. */
export function safeTaskError(error: unknown): string {
  if (error instanceof PermanentTaskError) return error.message.slice(0, 500);
  if (error instanceof Error && "code" in error && typeof error.code === "string")
    return `Operation failed (${error.code.replace(/[^A-Z0-9_]/g, "").slice(0, 40)})`;
  return "Operation failed; inspect provider health and configuration, then retry";
}
export async function executeNextTask(
  queue: TaskQueueProvider,
  registry: TaskRegistry,
  options: { signal?: AbortSignal; onFailure?: FailureObserver; heartbeatMs?: number } = {},
): Promise<boolean> {
  if (options.signal?.aborted) return false;
  const task = await queue.reserve(Object.keys(registry));
  if (!task) return false;
  const logger = createLogger({ name: "task-executor" });
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  let heartbeating = false;
  const timer = setInterval(() => {
    if (heartbeating) return;
    heartbeating = true;
    void queue
      .heartbeat(task)
      .then((ok) => {
        if (!ok) controller.abort();
      })
      .catch(() => controller.abort())
      .finally(() => {
        heartbeating = false;
      });
  }, options.heartbeatMs ?? 10_000);
  try {
    logger.info({ taskId: task.id, type: task.type, attempt: task.attempt }, "Task started");
    const handler = registry[task.type];
    if (!handler) throw new PermanentTaskError("Unsupported task type");
    await handler.execute(task, controller.signal);
    if (!controller.signal.aborted) await queue.acknowledge(task);
    logger.info({ taskId: task.id, cancelled: controller.signal.aborted }, "Task finished");
  } catch (error) {
    if (!(await queue.heartbeat(task))) return true;
    const reason = safeTaskError(error);
    const retryable = !(
      typeof error === "object" &&
      error !== null &&
      "retryable" in error &&
      error.retryable === false
    );
    const retrying = retryable && task.attempt < task.maxAttempts;
    await options.onFailure?.(task, reason, retrying);
    if (retrying)
      await queue.retry(task, new Date(Date.now() + retryDelayMs(task.attempt - 1)), reason);
    else await queue.deadLetter(task, reason);
    logger.warn({ taskId: task.id, reason, retrying }, "Task failed");
  } finally {
    clearInterval(timer);
    options.signal?.removeEventListener("abort", abort);
  }
  return true;
}
