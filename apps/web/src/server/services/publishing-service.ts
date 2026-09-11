import { enforceSubscription, enforceUsage } from "@contentforge/billing";
import { prisma } from "@contentforge/database";
import { MockSocialPlatformProvider } from "@contentforge/social";
import { NotFoundError, PublishBlockedError } from "@contentforge/shared";

export async function scheduleOrPublish(input: {
  workspaceId: string;
  contentItemId: string;
  socialAccountId: string;
  scheduledAt: Date;
  idempotencyKey: string;
  userId: string;
}) {
  const duplicate = await prisma.publishJob.findUnique({
    where: {
      workspaceId_idempotencyKey: {
        workspaceId: input.workspaceId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    include: { publishedPost: true },
  });
  if (duplicate) return { job: duplicate, replayed: true };
  const [content, account, subscription, limit, usage] = await Promise.all([
    prisma.contentItem.findFirst({
      where: { id: input.contentItemId, workspaceId: input.workspaceId, deletedAt: null },
      include: {
        approvalRequests: { orderBy: { createdAt: "desc" }, take: 1 },
        variants: {
          where: { isPrimary: true },
          include: { renderJobs: { where: { status: "SUCCEEDED" }, include: { outputs: true } } },
        },
      },
    }),
    prisma.socialAccount.findFirst({
      where: { id: input.socialAccountId, workspaceId: input.workspaceId, isActive: true },
      include: { socialConnection: true },
    }),
    prisma.subscription.findUnique({ where: { workspaceId: input.workspaceId } }),
    prisma.usageLimit.findUnique({ where: { workspaceId: input.workspaceId } }),
    prisma.usageEvent.aggregate({
      where: { workspaceId: input.workspaceId, periodMonth: new Date().toISOString().slice(0, 7) },
      _sum: { costCents: true },
      _count: { id: true },
    }),
  ]);
  if (!content) throw new NotFoundError("Content item", input.contentItemId);
  if (!account) throw new PublishBlockedError("The selected social account is unavailable");
  if (!subscription || !limit) throw new PublishBlockedError("Billing limits are not configured");
  const subscriptionCheck = enforceSubscription(subscription.status, subscription.trialEndsAt);
  if (!subscriptionCheck.allowed) throw new PublishBlockedError(subscriptionCheck.message!);
  const usageCheck = enforceUsage(
    "spend",
    {
      contentItems: usage._count.id,
      socialConnections: 0,
      brands: 0,
      teamMembers: 0,
      spendCents: usage._sum.costCents ?? 0,
    },
    {
      contentItems: limit.contentItemsPerMonth,
      socialConnections: limit.socialConnectionsLimit,
      brands: limit.brandsLimit,
      teamMembers: limit.teamMembersLimit,
      monthlyBudgetCents: limit.monthlyBudgetCents,
      warningThreshold: limit.budgetWarningPct,
    },
  );
  if (!usageCheck.allowed) throw new PublishBlockedError(usageCheck.message!);
  if (content.approvalRequests[0]?.status !== "APPROVED" || content.status !== "APPROVED")
    throw new PublishBlockedError("Content must have an approved review decision");
  if (!content.complianceAcknowledged)
    throw new PublishBlockedError("Compliance acknowledgment is required");
  const variant = content.variants[0];
  if (!variant || !variant.renderJobs.some((job) => job.outputs.length > 0))
    throw new PublishBlockedError("A completed rendered asset is required");
  if (account.socialConnection.status !== "ACTIVE")
    throw new PublishBlockedError("The social authorization is expired or inactive");
  if (input.scheduledAt.getTime() < Date.now() - 60_000)
    throw new PublishBlockedError("Scheduled time cannot be in the past");
  const isImmediate = input.scheduledAt.getTime() <= Date.now() + 60_000;
  if (!isImmediate) {
    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.publishJob.create({
        data: {
          workspaceId: input.workspaceId,
          contentVariantId: variant.id,
          socialAccountId: account.id,
          status: "PENDING",
          scheduledAt: input.scheduledAt,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.contentItem.update({
        where: { id: content.id },
        data: { status: "SCHEDULED", scheduledAt: input.scheduledAt },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          actorUserId: input.userId,
          action: "content.scheduled",
          targetType: "ContentItem",
          targetId: content.id,
          metadata: { publishJobId: created.id, scheduledAt: input.scheduledAt.toISOString() },
        },
      });
      return created;
    });
    return { job, replayed: false };
  }
  const provider = new MockSocialPlatformProvider();
  const published = await provider.createPost({
    idempotencyKey: input.idempotencyKey,
    accountId: account.externalAccountId,
    text: variant.captionText ?? "",
    title: content.title,
    media: variant.renderJobs
      .flatMap((job) => job.outputs)
      .slice(0, 1)
      .map((asset) => ({
        url: asset.storageKey,
        mimeType: "video/mp4",
        sizeBytes: asset.fileSizeBytes,
        aspectRatio: asset.aspectRatio.replace("RATIO_", "").replace("X", ":"),
        durationSeconds: asset.durationSeconds ?? undefined,
      })),
  });
  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.publishJob.create({
      data: {
        workspaceId: input.workspaceId,
        contentVariantId: variant.id,
        socialAccountId: account.id,
        status: "PUBLISHED",
        scheduledAt: input.scheduledAt,
        idempotencyKey: input.idempotencyKey,
        attemptCount: 1,
        publishedPost: {
          create: {
            workspaceId: input.workspaceId,
            socialAccountId: account.id,
            platform: "MOCK",
            externalPostId: published.externalPostId,
            permalink: published.permalink,
            publishedAt: published.publishedAt,
            rawResponseJson: { provider: "mock", redacted: true },
          },
        },
      },
    });
    await tx.contentItem.update({
      where: { id: content.id },
      data: { status: "PUBLISHED", scheduledAt: input.scheduledAt },
    });
    await tx.usageEvent.create({
      data: {
        workspaceId: input.workspaceId,
        type: "PUBLISH",
        quantity: 1,
        costCents: 0,
        referenceType: "PublishJob",
        referenceId: created.id,
        periodMonth: new Date().toISOString().slice(0, 7),
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.userId,
        action: "social.post.published",
        targetType: "ContentItem",
        targetId: content.id,
        metadata: { publishJobId: created.id, provider: "mock" },
      },
    });
    return created;
  });
  return { job, replayed: false };
}
