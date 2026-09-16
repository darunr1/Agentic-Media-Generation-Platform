import { prisma } from "@contentforge/database";
import { scriptSchema } from "@contentforge/ai";
import { ConflictError, NotFoundError, UsageLimitExceededError } from "@contentforge/shared";
import { json } from "@contentforge/workflows";

export async function decideIdea(
  workspaceId: string,
  userId: string,
  ideaId: string,
  status: "ACCEPTED" | "REJECTED",
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
    const idea = await tx.contentIdea.findFirst({
      where: {
        id: ideaId,
        workspaceId,
        deletedAt: null,
        campaign: { deletedAt: null, brand: { deletedAt: null } },
      },
      include: { campaign: true, contentItem: true },
    });
    if (!idea) throw new NotFoundError("Idea");
    if (idea.contentItem) {
      if (status === "ACCEPTED") return idea.contentItem;
      throw new ConflictError("An accepted idea already has content in production");
    }
    if (status === "REJECTED")
      return tx.contentIdea.update({ where: { id: idea.id }, data: { status } });
    if (idea.format !== "SHORT_VIDEO_9X16")
      throw new ConflictError("The local production workflow currently supports short video ideas");
    const limit = await tx.usageLimit.findUnique({ where: { workspaceId } });
    const count = await tx.contentItem.count({
      where: {
        workspaceId,
        createdAt: { gte: new Date(new Date().toISOString().slice(0, 7) + "-01") },
      },
    });
    if (limit && limit.contentItemsPerMonth >= 0 && count >= limit.contentItemsPerMonth)
      throw new UsageLimitExceededError();
    await tx.contentIdea.update({ where: { id: idea.id }, data: { status } });
    return tx.contentItem.create({
      data: {
        workspaceId,
        brandId: idea.campaign.brandId,
        campaignId: idea.campaignId,
        pillarId: idea.pillarId,
        contentIdeaId: idea.id,
        title: idea.title,
        primaryFormat: idea.format,
        createdByUserId: userId,
      },
    });
  });
}
export async function editContent(workspaceId: string, userId: string, id: string, input: unknown) {
  const output = scriptSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id = ${id} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
    const content = await tx.contentItem.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: { variants: { where: { isPrimary: true }, include: { script: true } } },
    });
    if (!content) throw new NotFoundError("Content");
    if (
      !["DRAFT", "AWAITING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "FAILED"].includes(
        content.status,
      )
    )
      throw new ConflictError("Content is busy, scheduled, or published");
    if (
      await tx.workflowRun.count({
        where: { contentItemId: id, status: { in: ["PENDING", "RUNNING", "WAITING"] } },
      })
    )
      throw new ConflictError("Wait for the active workflow before editing");
    const variant = content.variants[0];
    if (!variant?.script) throw new ConflictError("Generate a script first");
    await tx.contentVersion.create({
      data: { workspaceId, contentItemId: id, snapshot: json(output), createdByUserId: userId },
    });
    await tx.script.update({
      where: { id: variant.script.id },
      data: {
        openingHook: output.openingHook,
        narration: output.spokenNarration,
        cta: output.callToAction,
        caption: output.caption,
        onScreenText: output.onScreenText.join("\n"),
        hashtags: output.hashtags,
        modelMetadata: json(output),
        modelId: "studio-editor",
      },
    });
    await tx.contentVariant.update({
      where: { id: variant.id },
      data: {
        captionText:
          output.platformVariants.find((p) => p.platform.toUpperCase() === variant.platform)
            ?.caption ?? output.caption,
        hashtags:
          output.platformVariants.find((p) => p.platform.toUpperCase() === variant.platform)
            ?.hashtags ?? output.hashtags,
      },
    });
    // Edits always invalidate prior approvals and renders. New generation rechecks brand safety.
    await tx.approvalRequest.updateMany({
      where: { contentItemId: id, status: { in: ["APPROVED", "PENDING"] } },
      data: { status: "EXPIRED" },
    });
    await tx.contentItem.update({
      where: { id },
      data: { status: "CHANGES_REQUESTED", complianceAcknowledged: false },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "content.edited",
        targetType: "ContentItem",
        targetId: id,
      },
    });
    return { saved: true };
  });
}
