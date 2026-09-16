import { randomUUID } from "node:crypto";

import { Prisma, prisma, type PrismaClient, type QueuedTask } from "@contentforge/database";

import type { QueueTask, TaskQueueProvider } from "./queue";

export function queueTaskData<T>(task: QueueTask<T>): Prisma.QueuedTaskUncheckedCreateInput {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    workflowRunId: task.workflowRunId,
    type: task.type,
    payload: JSON.parse(JSON.stringify(task.payload)) as Prisma.InputJsonValue,
    idempotencyKey: task.idempotencyKey,
    scheduledAt: task.scheduledAt,
    maxAttempts: task.maxAttempts,
  };
}

export class PostgresTaskQueueProvider implements TaskQueueProvider {
  readonly name = "postgres";
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly leaseMs = 60_000,
  ) {}
  async enqueue<T>(task: QueueTask<T>) {
    await this.db.queuedTask.upsert({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: task.workspaceId,
          idempotencyKey: task.idempotencyKey,
        },
      },
      create: queueTaskData(task),
      update: {},
    });
  }
  async reserve(types?: readonly string[]): Promise<QueueTask | null> {
    return this.db.$transaction(async (tx) => {
      // Crashes on the final attempt cannot leave an unclaimable RUNNING row forever.
      const exhausted = await tx.queuedTask.findMany({
        where: { status: "RUNNING", leaseExpiresAt: { lte: new Date() } },
        select: { id: true, attemptCount: true, maxAttempts: true, workflowRunId: true },
      });
      for (const task of exhausted.filter((t) => t.attemptCount >= t.maxAttempts)) {
        const changed = await tx.queuedTask.updateMany({
          where: { id: task.id, status: "RUNNING", leaseExpiresAt: { lte: new Date() } },
          data: {
            status: "DEAD_LETTER",
            failedAt: new Date(),
            lastError: "Lease expired on final attempt",
          },
        });
        if (changed.count && task.workflowRunId) {
          await tx.workflowRun.updateMany({
            where: { id: task.workflowRunId, status: { in: ["PENDING", "RUNNING", "WAITING"] } },
            data: {
              status: "DEAD_LETTER",
              errorMessage: "Lease expired on final attempt",
              completedAt: new Date(),
            },
          });
          const run = await tx.workflowRun.findUnique({
            where: { id: task.workflowRunId },
            select: { contentItemId: true, workspaceId: true },
          });
          if (run?.contentItemId)
            await tx.contentItem.updateMany({
              where: {
                id: run.contentItemId,
                workspaceId: run.workspaceId,
                status: { notIn: ["PUBLISHED", "CANCELLED"] },
              },
              data: { status: "FAILED" },
            });
          const steps = await tx.workflowStep.findMany({
            where: { workflowRunId: task.workflowRunId },
            select: { id: true },
          });
          await tx.generationJob.updateMany({
            where: {
              workflowStepId: { in: steps.map((s) => s.id) },
              status: { in: ["PENDING", "RUNNING"] },
            },
            data: {
              status: "FAILED",
              validationErrors: { reason: "Lease expired on final attempt" },
            },
          });
          await tx.workflowStep.updateMany({
            where: { workflowRunId: task.workflowRunId, status: { in: ["RUNNING", "RETRYING"] } },
            data: { status: "FAILED", errorMessage: "Lease expired on final attempt" },
          });
        }
      }
      const rows = await tx.$queryRaw<QueuedTask[]>(Prisma.sql`
        WITH candidate AS (
          SELECT id FROM "QueuedTask"
          WHERE ((status IN ('QUEUED', 'RETRYING') AND "scheduledAt" <= timezone('UTC', clock_timestamp()))
              OR (status = 'RUNNING' AND "leaseExpiresAt" <= timezone('UTC', clock_timestamp())))
            AND "attemptCount" < "maxAttempts"
            ${types ? Prisma.sql`AND type IN (${Prisma.join([...types])})` : Prisma.empty}
          ORDER BY "scheduledAt", "createdAt"
          FOR UPDATE SKIP LOCKED LIMIT 1
        )
        UPDATE "QueuedTask" t SET status = 'RUNNING', "reservedAt" = timezone('UTC', clock_timestamp()),
          "leaseExpiresAt" = timezone('UTC', clock_timestamp()) + ${this.leaseMs} * INTERVAL '1 millisecond',
          "reservationToken" = ${randomUUID()}, "attemptCount" = "attemptCount" + 1, "updatedAt" = timezone('UTC', clock_timestamp())
        FROM candidate WHERE t.id = candidate.id RETURNING t.*`);
      const row = rows[0];
      return row
        ? {
            id: row.id,
            workspaceId: row.workspaceId,
            workflowRunId: row.workflowRunId ?? undefined,
            type: row.type,
            payload: row.payload,
            idempotencyKey: row.idempotencyKey,
            scheduledAt: row.scheduledAt,
            attempt: row.attemptCount,
            maxAttempts: row.maxAttempts,
            reservationToken: row.reservationToken ?? undefined,
          }
        : null;
    });
  }
  private owned(task: QueueTask): Prisma.QueuedTaskWhereInput {
    if (!task.reservationToken) throw new Error("Missing reservation token");
    return {
      id: task.id,
      workspaceId: task.workspaceId,
      status: "RUNNING",
      reservationToken: task.reservationToken,
      leaseExpiresAt: { gt: new Date() },
    };
  }
  async acknowledge(task: QueueTask) {
    await this.db.queuedTask.updateMany({
      where: this.owned(task),
      data: { status: "COMPLETED", completedAt: new Date(), leaseExpiresAt: null },
    });
  }
  async retry(task: QueueTask, scheduledAt: Date, reason: string) {
    await this.db.queuedTask.updateMany({
      where: this.owned(task),
      data: { status: "RETRYING", scheduledAt, lastError: reason, leaseExpiresAt: null },
    });
  }
  async deadLetter(task: QueueTask, reason: string) {
    await this.db.queuedTask.updateMany({
      where: this.owned(task),
      data: {
        status: "DEAD_LETTER",
        failedAt: new Date(),
        lastError: reason,
        leaseExpiresAt: null,
      },
    });
  }
  async cancel(id: string, workspaceId: string) {
    await this.db.queuedTask.updateMany({
      where: { id, workspaceId, status: { in: ["QUEUED", "RUNNING", "RETRYING"] } },
      data: { status: "CANCELLED", leaseExpiresAt: null },
    });
  }
  async heartbeat(task: QueueTask) {
    const result = await this.db.queuedTask.updateMany({
      where: this.owned(task),
      data: { leaseExpiresAt: new Date(Date.now() + this.leaseMs) },
    });
    return result.count === 1;
  }
  async healthCheck() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
