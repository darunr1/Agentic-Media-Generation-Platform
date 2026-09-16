import { z } from "zod";
import { prisma } from "@contentforge/database";
import { ConflictError, NotFoundError, UsageLimitExceededError } from "@contentforge/shared";

export const brandInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  industry: z.string().min(2).max(160),
  description: z.string().min(20).max(5000),
  productsServices: z.string().min(2).max(5000),
  targetCustomers: z.string().min(2).max(5000),
  geographicMarket: z.string().min(2).max(200),
  toneTags: z.array(z.string().max(80)).max(20).default([]),
  personality: z.string().max(2000).default(""),
  wordsToAvoid: z.array(z.string().max(100)).max(100).default([]),
  guidelines: z
    .array(
      z.object({
        type: z.enum([
          "PROHIBITED_CLAIM",
          "COMPLIANCE_NOTE",
          "REQUIRED_DISCLAIMER",
          "CTA_STANDARD",
        ]),
        content: z.string().min(1).max(2000),
      }),
    )
    .max(30)
    .default([]),
});
export async function saveBrand(workspaceId: string, userId: string, input: unknown, id?: string) {
  const { toneTags, personality, wordsToAvoid, guidelines, ...body } =
    brandInputSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
    if (id && !(await tx.brand.findFirst({ where: { id, workspaceId, deletedAt: null } })))
      throw new NotFoundError("Brand");
    if (!id) {
      const limit = await tx.usageLimit.findUnique({ where: { workspaceId } });
      const count = await tx.brand.count({ where: { workspaceId, deletedAt: null } });
      if (limit && limit.brandsLimit >= 0 && count >= limit.brandsLimit)
        throw new UsageLimitExceededError("Brand limit reached; archive an existing brand first");
    }
    const brand = id
      ? await tx.brand.update({ where: { id }, data: body })
      : await tx.brand.create({
          data: {
            ...body,
            workspaceId,
            slug: `${body.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .slice(0, 45)}-${crypto.randomUUID().slice(0, 8)}`,
            status: "ACTIVE",
          },
        });
    await tx.brandVoice.upsert({
      where: { brandId: brand.id },
      create: { brandId: brand.id, toneTags, personality, wordsToAvoid, preferredPhrases: [] },
      update: { toneTags, personality, wordsToAvoid },
    });
    await tx.brandGuideline.deleteMany({ where: { brandId: brand.id } });
    await tx.brandGuideline.createMany({
      data: guidelines.map((g) => ({ ...g, brandId: brand.id })),
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: id ? "brand.updated" : "brand.created",
        targetType: "Brand",
        targetId: brand.id,
      },
    });
    return brand;
  });
}
export async function archiveBrand(workspaceId: string, userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
    const busy = await tx.contentItem.count({
      where: {
        brandId: id,
        workspaceId,
        status: {
          in: [
            "SCRIPTING",
            "ASSET_GENERATION",
            "VOICE_GENERATION",
            "CAPTION_GENERATION",
            "RENDERING",
            "SCHEDULED",
            "PUBLISHING",
          ],
        },
      },
    });
    if (busy)
      throw new ConflictError(
        "Cancel active production and scheduled posts before archiving this brand",
      );
    const result = await tx.brand.updateMany({
      where: { id, workspaceId, deletedAt: null },
      data: { status: "ARCHIVED", deletedAt: new Date() },
    });
    if (!result.count) throw new NotFoundError("Brand");
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: "brand.archived",
        targetType: "Brand",
        targetId: id,
      },
    });
    return { archived: true };
  });
}
export const campaignInputSchema = z
  .object({
    brandId: z.string().min(1),
    name: z.string().min(2).max(120),
    objective: z.string().min(10).max(2000),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    targetPlatforms: z
      .array(z.enum(["MOCK", "INSTAGRAM", "FACEBOOK", "THREADS", "TIKTOK", "YOUTUBE", "X"]))
      .min(1)
      .max(7),
  })
  .refine((v) => v.endDate > v.startDate, "Campaign end must follow its start");
export async function saveCampaign(
  workspaceId: string,
  userId: string,
  input: unknown,
  id?: string,
) {
  const body = campaignInputSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    if (!(await tx.brand.findFirst({ where: { id: body.brandId, workspaceId, deletedAt: null } })))
      throw new NotFoundError("Brand");
    if (id && !(await tx.campaign.findFirst({ where: { id, workspaceId, deletedAt: null } })))
      throw new NotFoundError("Campaign");
    const campaign = id
      ? await tx.campaign.update({ where: { id }, data: body })
      : await tx.campaign.create({ data: { ...body, workspaceId } });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorUserId: userId,
        action: id ? "campaign.updated" : "campaign.created",
        targetType: "Campaign",
        targetId: campaign.id,
      },
    });
    return campaign;
  });
}
