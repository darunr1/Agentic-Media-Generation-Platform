import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { executeNextTask, PermanentTaskError } from "./executor";
import { LocalTaskQueueProvider, type QueueTask } from "./queue";

const task = (): QueueTask => ({
  id: randomUUID(),
  workspaceId: "workspace",
  type: "test",
  payload: { value: 7 },
  scheduledAt: new Date(0),
  idempotencyKey: randomUUID(),
  attempt: 0,
  maxAttempts: 2,
});
describe("task execution contract", () => {
  it("executes a handler before completing, and ignores duplicate idempotency keys", async () => {
    const queue = new LocalTaskQueueProvider(),
      job = task(),
      execute = vi.fn(async () => {});
    await queue.enqueue(job);
    await queue.enqueue({ ...job, id: randomUUID() });
    expect(queue.tasks.size).toBe(1);
    await executeNextTask(queue, { test: { execute } });
    expect(execute).toHaveBeenCalledOnce();
    expect(queue.tasks.get(job.id)?.status).toBe("COMPLETED");
    await queue.enqueue({ ...job, id: randomUUID() });
    expect(await queue.reserve()).toBeNull();
  });
  it("reserves exclusively even when two consumers race", async () => {
    const queue = new LocalTaskQueueProvider();
    await queue.enqueue(task());
    const claims = await Promise.all([queue.reserve(), queue.reserve()]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });
  it("retries transient failures and dead-letters exhausted attempts", async () => {
    const queue = new LocalTaskQueueProvider(),
      job = task();
    await queue.enqueue(job);
    const execute = async () => {
      throw new Error("transient");
    };
    await executeNextTask(queue, { test: { execute } });
    expect(queue.tasks.get(job.id)?.status).toBe("RETRYING");
    queue.tasks.get(job.id)!.task.scheduledAt = new Date(0);
    await executeNextTask(queue, { test: { execute } });
    expect(queue.tasks.get(job.id)?.status).toBe("DEAD_LETTER");
  });
  it("dead-letters permanent errors immediately", async () => {
    const queue = new LocalTaskQueueProvider(),
      job = task();
    await queue.enqueue(job);
    await executeNextTask(queue, {
      test: {
        execute: async () => {
          throw new PermanentTaskError("Invalid payload");
        },
      },
    });
    expect(queue.tasks.get(job.id)?.status).toBe("DEAD_LETTER");
    expect(queue.tasks.get(job.id)?.task.attempt).toBe(1);
  });
  it("cancels running work and fences late acknowledgements", async () => {
    const queue = new LocalTaskQueueProvider(),
      job = task();
    await queue.enqueue(job);
    const reserved = (await queue.reserve())!;
    await queue.cancel(job.id, "other-workspace");
    expect(await queue.heartbeat(reserved)).toBe(true);
    await queue.cancel(job.id, job.workspaceId);
    expect(await queue.heartbeat(reserved)).toBe(false);
    await queue.acknowledge(reserved);
    expect(queue.tasks.get(job.id)?.status).toBe("CANCELLED");
  });
  it("reclaims an expired lease and rejects the old token", async () => {
    vi.useFakeTimers();
    try {
      const queue = new LocalTaskQueueProvider(100),
        job = task();
      await queue.enqueue(job);
      const first = (await queue.reserve())!;
      vi.advanceTimersByTime(101);
      const second = (await queue.reserve())!;
      expect(second.reservationToken).not.toBe(first.reservationToken);
      await queue.acknowledge(first);
      expect(queue.tasks.get(job.id)?.status).toBe("RUNNING");
      await queue.acknowledge(second);
      expect(queue.tasks.get(job.id)?.status).toBe("COMPLETED");
    } finally {
      vi.useRealTimers();
    }
  });
});
