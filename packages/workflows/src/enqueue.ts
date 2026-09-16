import { randomUUID } from "node:crypto";

import { enforceSubscription } from "@contentforge/billing";
import { prisma, Prisma, type WorkflowRunType } from "@contentforge/database";
import {
  ConflictError,
  NotFoundError,
  RateLimitedError,
  PublishBlockedError,
} from "@contentforge/shared";

import { queueTaskData } from "./postgres-queue";
import { payloadSchema, type WorkflowPayload } from "./runtime";

export async function startGeneration(input: {
  workspaceId: string;
  userId: string;
  campaignId?: string;
  contentItemId?: string;
  operation: "strategy" | "ideas" | "script";
  idempotencyKey: string;
  preserveScript?: boolean;
}) {
  const validTarget =
    input.operation === "script"
      ? Boolean(input.contentItemId) && !input.campaignId
      : Boolean(input.campaignId) && !input.contentItemId;
  if (!validTarget)
    throw new ConflictError(
      "Provide only the content item for script generation, or only the campaign for planning",
    );
  const types: Record<typeof input.operation, WorkflowRunType> = {
    strategy: "STRATEGY_GENERATION",
    ideas: "IDEA_GENERATION",
    script: "CONTENT_PRODUCTION",
  };
  return prisma.$transaction(
    async (tx) => {
      // Serialize admission per tenant: idempotency, plan limits and rate limits are cross-process.
      await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${input.workspaceId} FOR UPDATE`;
      const existing = await tx.workflowRun.findUnique({
        where: {
          workspaceId_idempotencyKey: {
            workspaceId: input.workspaceId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) return existing;
      const subscription = await tx.subscription.findUnique({
        where: { workspaceId: input.workspaceId },
      });
      const limit = await tx.usageLimit.findUnique({ where: { workspaceId: input.workspaceId } });
      if (
        !subscription ||
        !limit ||
        !enforceSubscription(subscription.status, subscription.trialEndsAt).allowed
      )
        throw new PublishBlockedError("An active plan and local usage limits are required");
      const spend = await tx.providerUsage.aggregate({
        where: {
          workspaceId: input.workspaceId,
          createdAt: { gte: new Date(new Date().toISOString().slice(0, 7) + "-01") },
        },
        _sum: { costCents: true },
      });
      if ((spend._sum.costCents ?? 0) >= limit.monthlyBudgetCents)
        throw new PublishBlockedError("Workspace generation budget reached");
      const count = await tx.workflowRun.count({
        where: {
          workspaceId: input.workspaceId,
          createdAt: { gte: new Date(Date.now() - 60_000) },
        },
      });
      if (count >= 10) throw new RateLimitedError(60);
      const campaign = input.campaignId
        ? await tx.campaign.findFirst({
            where: {
              id: input.campaignId,
              workspaceId: input.workspaceId,
              deletedAt: null,
              brand: { deletedAt: null },
            },
          })
        : null;
      if (input.operation !== "script" && !campaign) throw new NotFoundError("Campaign");
      if (input.operation === "ideas" && !campaign?.strategyJson)
        throw new ConflictError("Generate a campaign strategy first");
      if (input.operation === "script") {
        const content = await tx.contentItem.findFirst({
          where: { id: input.contentItemId, workspaceId: input.workspaceId, deletedAt: null },
        });
        if (!content) throw new NotFoundError("Content item");
        if (!["DRAFT", "CHANGES_REQUESTED", "FAILED", "AWAITING_REVIEW"].includes(content.status))
          throw new ConflictError("Content cannot be generated in its current state");
        const active = await tx.workflowRun.count({
          where: { contentItemId: content.id, status: { in: ["RUNNING", "PENDING", "WAITING"] } },
        });
        if (active) throw new ConflictError("Content already has an active workflow");
        const attempts = await tx.workflowRun.count({
          where: { contentItemId: content.id, type: "CONTENT_PRODUCTION" },
        });
        if (attempts >= Number(process.env.MAX_GENERATION_JOBS_PER_CONTENT_ITEM ?? 10))
          throw new ConflictError("Content generation limit reached");
        await tx.approvalRequest.updateMany({
          where: { contentItemId: content.id, status: { in: ["PENDING", "APPROVED"] } },
          data: { status: "EXPIRED" },
        });
        await tx.contentItem.update({
          where: { id: content.id },
          data: { status: "SCRIPTING", complianceAcknowledged: false },
        });
      }
      const run = await tx.workflowRun.create({
        data: {
          workspaceId: input.workspaceId,
          contentItemId: input.contentItemId,
          type: types[input.operation],
          idempotencyKey: input.idempotencyKey,
        },
      });
      const payload: WorkflowPayload = {
        userId: input.userId,
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        ...(input.contentItemId ? { contentItemId: input.contentItemId } : {}),
        ...(input.preserveScript ? { preserveScript: true } : {}),
      };
      await tx.queuedTask.create({
        data: queueTaskData({
          id: randomUUID(),
          workspaceId: input.workspaceId,
          workflowRunId: run.id,
          type: `generation.${input.operation}`,
          payload,
          idempotencyKey: `${run.id}:generation.${input.operation}`,
          scheduledAt: new Date(),
          attempt: 0,
          maxAttempts: 3,
        }),
      });
      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorUserId: input.userId,
          action: "workflow.started",
          targetType: "WorkflowRun",
          targetId: run.id,
        },
      });
      return run;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

export async function cancelWorkflow(workspaceId: string, id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.workflowRun.findFirst({ where: { id, workspaceId } });
    if (!run) throw new NotFoundError("Workflow");
    const membership = await tx.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    const privileged = run.type === "PUBLISH" || run.type === "ANALYTICS_COLLECTION";
    if (
      !membership ||
      !(privileged ? ["OWNER", "ADMIN"] : ["OWNER", "ADMIN", "EDITOR"]).includes(membership.role)
    )
      throw new PublishBlockedError("Workflow cancellation permission required");
    // Lock tasks first, matching fencedTransaction's lock order.
    await tx.$queryRaw`SELECT id FROM "QueuedTask" WHERE "workflowRunId" = ${id} FOR UPDATE`;
    const result = await tx.workflowRun.updateMany({
      where: { id, workspaceId, status: { in: ["PENDING", "RUNNING", "WAITING"] } },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledByUserId: userId,
        completedAt: new Date(),
      },
    });
    if (!result.count) throw new ConflictError("Workflow is already terminal");
    await tx.queuedTask.updateMany({
      where: { workflowRunId: id, status: { in: ["QUEUED", "RUNNING", "RETRYING"] } },
      data: { status: "CANCELLED", leaseExpiresAt: null },
    });
    await tx.workflowStep.updateMany({
      where: { workflowRunId: id, status: { in: ["PENDING", "RUNNING", "RETRYING"] } },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    const steps = await tx.workflowStep.findMany({
      where: { workflowRunId: id },
      select: { id: true },
    });
    await tx.generationJob.updateMany({
      where: {
        workspaceId,
        workflowStepId: { in: steps.map((s) => s.id) },
        status: { in: ["PENDING", "RUNNING"] },
      },
      data: { status: "FAILED", validationErrors: { reason: "Workflow cancelled" } },
    });
    const tasks = await tx.queuedTask.findMany({
      where: { workflowRunId: id },
      select: { idempotencyKey: true, payload: true },
    });
    const publishIds = tasks.flatMap((task) => {
      const payload = payloadSchema.safeParse(task.payload);
      return payload.success && payload.data.publishJobId ? [payload.data.publishJobId] : [];
    });
    await tx.publishJob.updateMany({
      where: { workspaceId, id: { in: publishIds }, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "CANCELLED" },
    });
    await tx.renderJob.updateMany({
      where: {
        workspaceId,
        idempotencyKey: { in: tasks.map((t) => t.idempotencyKey) },
        status: { in: ["RUNNING", "QUEUED"] },
      },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    if (run.contentItemId)
      await tx.contentItem.updateMany({
        where: { id: run.contentItemId, workspaceId, status: { not: "PUBLISHED" } },
        data: { status: "CANCELLED" },
      });
    return { cancelled: true };
  });
}
