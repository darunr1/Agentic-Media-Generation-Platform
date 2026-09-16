import { randomUUID } from "node:crypto";

import { ProviderError, type ProviderResult } from "@contentforge/ai";
import type { Prisma } from "@contentforge/database";
import { prisma, type GenerationJobType, type ContentItemStatus } from "@contentforge/database";
import { z } from "zod";

import { PermanentTaskError } from "./executor";
import { queueTaskData } from "./postgres-queue";
import type { QueueTask } from "./queue";

export const payloadSchema = z
  .object({
    userId: z.string().min(1),
    campaignId: z.string().min(1).optional(),
    contentItemId: z.string().min(1).optional(),
    publishJobId: z.string().min(1).optional(),
    postId: z.string().min(1).optional(),
    preserveScript: z.boolean().optional(),
  })
  .strict();
export type WorkflowPayload = z.infer<typeof payloadSchema>;
export const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function fencedTransaction<T>(
  task: QueueTask,
  signal: AbortSignal,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  signal.throwIfAborted();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "QueuedTask" WHERE id = ${task.id} AND "reservationToken" = ${task.reservationToken ?? ""} AND status = 'RUNNING' AND "leaseExpiresAt" > timezone('UTC', clock_timestamp()) FOR UPDATE`;
    if (!rows.length) throw new PermanentTaskError("Task lease lost or cancelled");
    const run = await tx.workflowRun.findFirst({
      where: {
        id: task.workflowRunId,
        workspaceId: task.workspaceId,
        status: { in: ["PENDING", "RUNNING", "WAITING"] },
      },
    });
    if (!run) throw new PermanentTaskError("Workflow is no longer active");
    signal.throwIfAborted();
    return fn(tx);
  });
}
export async function loadTask(task: QueueTask, signal: AbortSignal) {
  const parsed = payloadSchema.safeParse(task.payload);
  if (!parsed.success || !task.workflowRunId) throw new PermanentTaskError("Invalid task payload");
  const payload = parsed.data;
  const run = await prisma.workflowRun.findFirst({
    where: {
      id: task.workflowRunId,
      workspaceId: task.workspaceId,
      workspace: { deletedAt: null },
    },
  });
  if (!run || run.status === "CANCELLED")
    throw new PermanentTaskError("Workflow unavailable or cancelled");
  if (payload.contentItemId && payload.contentItemId !== run.contentItemId)
    throw new PermanentTaskError("Content ownership mismatch");
  const member = await prisma.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId: task.workspaceId, userId: payload.userId } },
  });
  const roles =
    task.type.startsWith("publish") || task.type.startsWith("analytics")
      ? ["OWNER", "ADMIN"]
      : ["OWNER", "ADMIN", "EDITOR"];
  if (!member || !roles.includes(member.role))
    throw new PermanentTaskError("Workflow initiator no longer has permission");
  await fencedTransaction(task, signal, async (tx) => {
    await tx.workflowRun.update({
      where: { id: run.id },
      data: { status: "RUNNING", startedAt: run.startedAt ?? new Date(), errorMessage: null },
    });
  });
  return payload;
}

export async function runStep<T>(
  task: QueueTask,
  signal: AbortSignal,
  sequence: number,
  name: string,
  schema: z.ZodType<T>,
  execute: () => Promise<ProviderResult<T>>,
  type: GenerationJobType = "SCRIPT",
): Promise<ProviderResult<T>> {
  const key = `${task.workflowRunId}:${sequence}`;
  const step = await fencedTransaction(task, signal, (tx) =>
    tx.workflowStep.upsert({
      where: {
        workflowRunId_sequenceNumber: {
          workflowRunId: task.workflowRunId!,
          sequenceNumber: sequence,
        },
      },
      create: {
        workflowRunId: task.workflowRunId!,
        sequenceNumber: sequence,
        name,
        agentName: name.includes("Agent") ? name.split(".")[0] : null,
        idempotencyKey: key,
        status: "RUNNING",
        startedAt: new Date(),
        input: json(task.payload),
      },
      update: {},
    }),
  );
  if (step.status === "SUCCEEDED" && step.output) {
    const stored = step.output as unknown as ProviderResult<unknown>;
    return { ...stored, data: schema.parse(stored.data) };
  }
  await fencedTransaction(task, signal, async (tx) => {
    await tx.workflowStep.update({
      where: { id: step.id },
      data: { status: "RUNNING", retryCount: task.attempt - 1, errorMessage: null },
    });
    await tx.generationJob.upsert({
      where: { workspaceId_idempotencyKey: { workspaceId: task.workspaceId, idempotencyKey: key } },
      create: {
        id: `${task.workflowRunId}-${sequence}`,
        workspaceId: task.workspaceId,
        type,
        provider: "pending",
        model: "pending",
        status: "RUNNING",
        promptVersion: "agents-v1",
        inputJson: json(task.payload),
        workflowStepId: step.id,
        idempotencyKey: key,
      },
      update: { status: "RUNNING", retryCount: task.attempt - 1 },
    });
  });
  let result: ProviderResult<T>;
  try {
    result = await execute();
  } catch (error) {
    if (error instanceof ProviderError && error.usageReports?.length) {
      await fencedTransaction(task, signal, async (tx) => {
        for (const report of error.usageReports!)
          await tx.providerUsage.create({
            data: {
              workspaceId: task.workspaceId,
              provider: report.provider,
              capability: name,
              costCents: report.costCents,
              tokensIn: report.inputTokens,
              tokensOut: report.outputTokens,
              durationMs: report.durationMs,
              referenceType: "WorkflowStepFailedAttempt",
              referenceId: step.id,
            },
          });
        await tx.workflowRun.update({
          where: { id: task.workflowRunId! },
          data: {
            totalCostCents: {
              increment: error.usageReports!.reduce((sum, u) => sum + u.costCents, 0),
            },
          },
        });
        await tx.workflowStep.update({
          where: { id: step.id },
          data: {
            validation: { valid: false },
            output: json({ usageReports: error.usageReports }),
          },
        });
      });
    }
    throw error;
  }
  const data = schema.parse(result.data);
  await fencedTransaction(task, signal, async (tx) => {
    await tx.workflowStep.update({
      where: { id: step.id },
      data: {
        status: "SUCCEEDED",
        output: json({ ...result, data }),
        validation: { valid: true },
        provider: result.usage.provider,
        model: result.usage.model,
        costCents: result.usage.costCents,
        completedAt: new Date(),
      },
    });
    const job = await tx.generationJob.update({
      where: { workspaceId_idempotencyKey: { workspaceId: task.workspaceId, idempotencyKey: key } },
      data: {
        provider: result.usage.provider,
        model: result.usage.model,
        status: "SUCCEEDED",
        outputJson: json(data),
        costCents: result.usage.costCents,
        durationMs: result.usage.durationMs,
        tokensIn: result.usage.inputTokens,
        tokensOut: result.usage.outputTokens,
      },
    });
    for (const report of result.usageReports ?? [result.usage])
      await tx.providerUsage.create({
        data: {
          workspaceId: task.workspaceId,
          provider: report.provider,
          capability: name,
          costCents: report.costCents,
          tokensIn: report.inputTokens,
          tokensOut: report.outputTokens,
          durationMs: report.durationMs,
          referenceType: "GenerationJob",
          referenceId: job.id,
        },
      });
    await tx.workflowRun.update({
      where: { id: task.workflowRunId! },
      data: { currentStepIndex: sequence, totalCostCents: { increment: result.usage.costCents } },
    });
  });
  return { ...result, data };
}
export async function advance(
  task: QueueTask,
  signal: AbortSignal,
  next?: { type: string; payload: WorkflowPayload },
  status?: ContentItemStatus,
) {
  await fencedTransaction(task, signal, async (tx) => {
    await tx.queuedTask.update({
      where: { id: task.id },
      data: { status: "COMPLETED", completedAt: new Date(), leaseExpiresAt: null },
    });
    const payload = payloadSchema.parse(task.payload);
    if (payload.contentItemId && status)
      await tx.contentItem.updateMany({
        where: { id: payload.contentItemId, workspaceId: task.workspaceId, deletedAt: null },
        data: { status },
      });
    if (next) {
      const key = `${task.workflowRunId}:${next.type}`;
      await tx.queuedTask.upsert({
        where: {
          workspaceId_idempotencyKey: { workspaceId: task.workspaceId, idempotencyKey: key },
        },
        create: queueTaskData({
          id: randomUUID(),
          workspaceId: task.workspaceId,
          workflowRunId: task.workflowRunId,
          type: next.type,
          payload: next.payload,
          idempotencyKey: key,
          scheduledAt: new Date(),
          attempt: 0,
          maxAttempts: 3,
        }),
        update: {},
      });
    } else
      await tx.workflowRun.update({
        where: { id: task.workflowRunId! },
        data: { status: "SUCCEEDED", completedAt: new Date() },
      });
  });
}
export async function recordTaskFailure(task: QueueTask, reason: string, retrying: boolean) {
  if (!task.workflowRunId) return;
  await prisma.$transaction(async (tx) => {
    const owned = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "QueuedTask" WHERE id = ${task.id} AND "reservationToken" = ${task.reservationToken ?? ""} AND status = 'RUNNING' AND "leaseExpiresAt" > timezone('UTC', clock_timestamp()) FOR UPDATE`;
    if (!owned.length) return;
    const active = await tx.workflowRun.updateMany({
      where: {
        id: task.workflowRunId,
        workspaceId: task.workspaceId,
        status: { in: ["RUNNING", "WAITING", "PENDING"] },
      },
      data: {
        status: retrying ? "WAITING" : "DEAD_LETTER",
        errorMessage: reason,
        ...(retrying ? {} : { completedAt: new Date() }),
      },
    });
    if (!active.count) return;
    await tx.workflowStep.updateMany({
      where: { workflowRunId: task.workflowRunId, status: { in: ["RUNNING", "RETRYING"] } },
      data: {
        status: retrying ? "RETRYING" : "FAILED",
        errorMessage: reason,
        retryCount: task.attempt,
      },
    });
    const steps = await tx.workflowStep.findMany({
      where: { workflowRunId: task.workflowRunId },
      select: { id: true },
    });
    await tx.generationJob.updateMany({
      where: {
        workspaceId: task.workspaceId,
        workflowStepId: { in: steps.map((s) => s.id) },
        status: "RUNNING",
      },
      data: {
        status: retrying ? "PENDING" : "FAILED",
        validationErrors: json({ error: reason }),
        retryCount: task.attempt,
      },
    });
    await tx.renderJob.updateMany({
      where: {
        workspaceId: task.workspaceId,
        idempotencyKey: task.idempotencyKey,
        status: "RUNNING",
      },
      data: { status: retrying ? "QUEUED" : "FAILED", errorMessage: reason },
    });
    const payload = payloadSchema.safeParse(task.payload);
    if (!retrying && payload.success && payload.data.publishJobId)
      await tx.publishJob.updateMany({
        where: {
          workspaceId: task.workspaceId,
          id: payload.data.publishJobId,
          status: { in: ["PENDING", "PROCESSING"] },
        },
        data: { status: "FAILED", attemptCount: task.attempt },
      });
    if (!retrying && payload.success && payload.data.contentItemId)
      await tx.contentItem.updateMany({
        where: {
          id: payload.data.contentItemId,
          workspaceId: task.workspaceId,
          status: { notIn: ["PUBLISHED", "CANCELLED"] },
        },
        data: { status: "FAILED" },
      });
  });
}
