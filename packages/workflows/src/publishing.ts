import { randomUUID } from "node:crypto";

import { enforceSubscription } from "@contentforge/billing";
import { prisma, type Prisma } from "@contentforge/database";
import { ConflictError, NotFoundError, PublishBlockedError } from "@contentforge/shared";
import { createSocialProvider } from "@contentforge/social";
import { z } from "zod";

import { PermanentTaskError, type TaskRegistry } from "./executor";
import { queueTaskData } from "./postgres-queue";
import { advance, fencedTransaction, loadTask, runStep } from "./runtime";

async function publishable(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  contentItemId: string,
  socialAccountId: string,
  scheduled = false,
) {
  const content = await tx.contentItem.findFirst({
    where: { id: contentItemId, workspaceId, deletedAt: null, brand: { deletedAt: null } },
    include: {
      approvalRequests: { orderBy: { createdAt: "desc" }, take: 1 },
      variants: {
        where: { isPrimary: true, deletedAt: null },
        include: {
          renderJobs: {
            where: { status: "SUCCEEDED" },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { outputs: true },
          },
        },
      },
    },
  });
  const account = await tx.socialAccount.findFirst({
    where: { id: socialAccountId, workspaceId, isActive: true },
    include: { socialConnection: true },
  });
  const subscription = await tx.subscription.findUnique({ where: { workspaceId } });
  if (!content || !account) throw new PublishBlockedError("Content or destination unavailable");
  if (!subscription || !enforceSubscription(subscription.status, subscription.trialEndsAt).allowed)
    throw new PublishBlockedError("Subscription is inactive");
  if (
    !content.complianceAcknowledged ||
    content.approvalRequests[0]?.status !== "APPROVED" ||
    !(scheduled ? ["SCHEDULED", "PUBLISHING"] : ["APPROVED"]).includes(content.status)
  )
    throw new PublishBlockedError("Latest content must be approved with compliance acknowledged");
  if (
    account.socialConnection.workspaceId !== workspaceId ||
    account.socialConnection.status !== "ACTIVE" ||
    account.socialConnection.deletedAt ||
    (account.socialConnection.tokenExpiresAt &&
      account.socialConnection.tokenExpiresAt <= new Date())
  )
    throw new PublishBlockedError("Social authorization is inactive or expired");
  const variant = content.variants[0],
    output = variant?.renderJobs[0]?.outputs[0];
  if (!variant || !output) throw new PublishBlockedError("A completed rendered asset is required");
  const provider = createSocialProvider(account.platform);
  if (provider.getPublishingCapabilities().setupRequired)
    throw new PublishBlockedError("Social platform setup required");
  return { content, account, variant, output, provider };
}
export async function scheduleOrPublish(input: {
  workspaceId: string;
  contentItemId: string;
  socialAccountId: string;
  scheduledAt: Date;
  idempotencyKey: string;
  userId: string;
}) {
  if (
    !Number.isFinite(input.scheduledAt.getTime()) ||
    input.scheduledAt.getTime() < Date.now() - 60_000
  )
    throw new PublishBlockedError("Invalid scheduled time");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id = ${input.contentItemId} AND "workspaceId" = ${input.workspaceId} FOR UPDATE`;
    const existing = await tx.publishJob.findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: input.workspaceId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return { job: existing, replayed: true };
    const { variant } = await publishable(
      tx,
      input.workspaceId,
      input.contentItemId,
      input.socialAccountId,
    );
    if (
      await tx.publishJob.findUnique({
        where: {
          contentVariantId_socialAccountId: {
            contentVariantId: variant.id,
            socialAccountId: input.socialAccountId,
          },
        },
      })
    )
      throw new ConflictError("This content is already scheduled for that account");
    const run = await tx.workflowRun.create({
      data: {
        workspaceId: input.workspaceId,
        contentItemId: input.contentItemId,
        type: "PUBLISH",
        idempotencyKey: `publish:${input.idempotencyKey}`,
      },
    });
    const job = await tx.publishJob.create({
      data: {
        workspaceId: input.workspaceId,
        contentVariantId: variant.id,
        socialAccountId: input.socialAccountId,
        status: "PENDING",
        scheduledAt: input.scheduledAt,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await tx.queuedTask.create({
      data: queueTaskData({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        workflowRunId: run.id,
        type: "publish.content",
        payload: { userId: input.userId, contentItemId: input.contentItemId, publishJobId: job.id },
        idempotencyKey: `${run.id}:publish.content`,
        scheduledAt: input.scheduledAt,
        attempt: 0,
        maxAttempts: 3,
      }),
    });
    await tx.contentItem.update({
      where: { id: input.contentItemId },
      data: { status: "SCHEDULED", scheduledAt: input.scheduledAt },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.userId,
        action: "content.scheduled",
        targetType: "ContentItem",
        targetId: input.contentItemId,
      },
    });
    return { job, workflowRunId: run.id, replayed: false };
  });
}
export const publishingHandlers: TaskRegistry = {
  "publish.content": {
    async execute(task, signal) {
      const payload = await loadTask(task, signal);
      const job = await prisma.publishJob.findFirst({
        where: { id: payload.publishJobId, workspaceId: task.workspaceId },
        include: { publishedPost: true, contentVariant: true },
      });
      if (
        !job ||
        !payload.publishJobId ||
        job.contentVariant.contentItemId !== payload.contentItemId
      )
        throw new PermanentTaskError("Publish job ownership mismatch");
      const result = await runStep(
        task,
        signal,
        80,
        "MockPublishing",
        z.object({ postId: z.string() }),
        async () => {
          const existing = await prisma.publishedPost.findUnique({
            where: { publishJobId: job.id },
          });
          if (existing)
            return {
              data: { postId: existing.id },
              usage: { provider: "mock", model: "social-v1", costCents: 0, durationMs: 0 },
            };
          // Approval is checked at execution time, not only when the post was scheduled.
          const post = await fencedTransaction(task, signal, async (tx) => {
            await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id = ${payload.contentItemId!} FOR UPDATE`;
            const { content, account, variant, output, provider } = await publishable(
              tx,
              task.workspaceId,
              payload.contentItemId!,
              job.socialAccountId,
              true,
            );
            if (account.platform !== "MOCK")
              throw new PermanentTaskError("Real social publishing requires setup");
            const input = {
              idempotencyKey: `${task.workspaceId}:${job.idempotencyKey}`,
              accountId: account.externalAccountId,
              title: content.title,
              text: variant.captionText ?? "",
              media: [
                {
                  url: output.storageKey,
                  mimeType: "video/mp4",
                  sizeBytes: output.fileSizeBytes,
                  aspectRatio: "9:16",
                  durationSeconds: output.durationSeconds ?? undefined,
                },
              ],
            };
            const errors = provider.validateContent(input);
            if (errors.length)
              throw new PermanentTaskError("Content is incompatible with destination capabilities");
            const published = await provider.createPost(input); // Deterministic mock; no external network in transaction.
            const created = await tx.publishedPost.create({
              data: {
                publishJobId: job.id,
                workspaceId: task.workspaceId,
                socialAccountId: account.id,
                platform: "MOCK",
                externalPostId: published.externalPostId,
                publishedAt: published.publishedAt,
                rawResponseJson: { provider: "mock" },
              },
            });
            await tx.publishJob.update({
              where: { id: job.id },
              data: { status: "PUBLISHED", attemptCount: task.attempt },
            });
            await tx.contentItem.update({
              where: { id: content.id },
              data: { status: "PUBLISHED" },
            });
            await tx.usageEvent.create({
              data: {
                workspaceId: task.workspaceId,
                type: "PUBLISH",
                referenceType: "PublishJob",
                referenceId: job.id,
                periodMonth: new Date().toISOString().slice(0, 7),
              },
            });
            await tx.auditLog.create({
              data: {
                workspaceId: task.workspaceId,
                actorType: "SYSTEM",
                action: "social.post.published",
                targetType: "PublishedPost",
                targetId: created.id,
              },
            });
            return created;
          }).catch((error) => {
            if (error instanceof PublishBlockedError) throw new PermanentTaskError(error.message);
            throw error;
          });
          return {
            data: { postId: post.id },
            usage: { provider: "mock", model: "social-v1", durationMs: 0, costCents: 0 },
          };
        },
        "VIDEO",
      );
      await advance(task, signal, {
        type: "analytics.collect",
        payload: { ...payload, postId: result.data.postId },
      });
    },
  },
  "analytics.collect": {
    async execute(task, signal) {
      const payload = await loadTask(task, signal);
      const post = await prisma.publishedPost.findFirst({
        where: { id: payload.postId, workspaceId: task.workspaceId },
      });
      if (!post || !payload.postId) throw new PermanentTaskError("Published post unavailable");
      await runStep(
        task,
        signal,
        90,
        "AnalyticsCollection",
        z.object({ snapshotId: z.string() }),
        async () => {
          const provider = createSocialProvider(post.platform);
          if (provider.getPublishingCapabilities().setupRequired)
            throw new PermanentTaskError("Analytics provider setup required");
          const metrics = await provider.getPostAnalytics(post.externalPostId);
          const normalized = z
            .object({
              views: z.number().int().nonnegative().nullable().optional(),
              reach: z.number().int().nonnegative().nullable().optional(),
              impressions: z.number().int().nonnegative().nullable().optional(),
              likes: z.number().int().nonnegative().nullable().optional(),
              comments: z.number().int().nonnegative().nullable().optional(),
              shares: z.number().int().nonnegative().nullable().optional(),
              saves: z.number().int().nonnegative().nullable().optional(),
              clicks: z.number().int().nonnegative().nullable().optional(),
              watchTimeSeconds: z.number().int().nonnegative().nullable().optional(),
              completionRate: z.number().min(0).max(1).nullable().optional(),
              followersGained: z.number().int().nullable().optional(),
            })
            .parse(metrics);
          const capturedAt = task.scheduledAt;
          const snapshot = await fencedTransaction(task, signal, (tx) =>
            tx.analyticsSnapshot.upsert({
              where: { publishedPostId_capturedAt: { publishedPostId: post.id, capturedAt } },
              create: {
                workspaceId: task.workspaceId,
                publishedPostId: post.id,
                capturedAt,
                ...normalized,
                raw: { source: post.platform === "MOCK" ? "deterministic-mock" : post.platform },
              },
              update: {},
            }),
          );
          return {
            data: { snapshotId: snapshot.id },
            usage: {
              provider: provider.platform.toLowerCase(),
              model: "normalized-analytics-v1",
              costCents: 0,
              durationMs: 0,
            },
          };
        },
        "VIDEO",
      );
      await advance(task, signal);
    },
  },
};

export async function decideApproval(input: {
  workspaceId: string;
  userId: string;
  approvalRequestId: string;
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  notes?: string;
  complianceAcknowledged?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.approvalRequest.findFirst({
      where: { id: input.approvalRequestId, workspaceId: input.workspaceId },
    });
    if (!request) throw new NotFoundError("Approval request");
    await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id = ${request.contentItemId} FOR UPDATE`;
    const content = await tx.contentItem.findFirst({
      where: { id: request.contentItemId, workspaceId: input.workspaceId, deletedAt: null },
      include: { approvalRequests: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (
      !content ||
      content.status !== "AWAITING_REVIEW" ||
      content.approvalRequests[0]?.id !== request.id ||
      content.approvalRequests[0]?.status !== "PENDING"
    )
      throw new ConflictError("Only the latest pending content version can be reviewed");
    if (
      input.decision === "APPROVED" &&
      !input.complianceAcknowledged &&
      !content.complianceAcknowledged
    )
      throw new PublishBlockedError("Acknowledge compliance before approval");
    await tx.approvalRequest.update({
      where: { id: request.id },
      data: { status: input.decision },
    });
    const decision = await tx.approvalDecision.create({
      data: {
        approvalRequestId: request.id,
        decidedByUserId: input.userId,
        decision: input.decision,
        notes: input.notes,
      },
    });
    await tx.contentItem.update({
      where: { id: content.id },
      data: {
        status: input.decision === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED",
        complianceAcknowledged: input.decision === "APPROVED",
        complianceAcknowledgedByUserId: input.decision === "APPROVED" ? input.userId : null,
        complianceAcknowledgedAt: input.decision === "APPROVED" ? new Date() : null,
      },
    });
    if (input.notes)
      await tx.contentComment.create({
        data: {
          workspaceId: input.workspaceId,
          contentItemId: content.id,
          authorUserId: input.userId,
          body: input.notes,
        },
      });
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.userId,
        action: `content.review.${input.decision.toLowerCase()}`,
        targetType: "ContentItem",
        targetId: content.id,
      },
    });
    return decision;
  });
}
