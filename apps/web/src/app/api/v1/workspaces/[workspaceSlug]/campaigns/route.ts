import { NextResponse } from "next/server";
import { z } from "zod";
import { assertWorkspaceMembership, assertWorkspacePermission } from "@contentforge/auth";
import { prisma } from "@contentforge/database";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
const schema = z
  .object({
    brandId: z.string().min(1),
    name: z.string().min(2).max(120),
    objective: z.string().min(10).max(2000),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    targetPlatforms: z
      .array(z.enum(["MOCK", "INSTAGRAM", "FACEBOOK", "THREADS", "TIKTOK", "YOUTUBE", "X"]))
      .min(1),
  })
  .refine((v) => v.endDate > v.startDate, { message: "endDate must be after startDate" });
export const GET = apiHandler<{ workspaceSlug: string }>(async (_req, { userId, params }) => {
  const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspaceMembership(userId, w.id);
  return jsonOk(
    await prisma.campaign.findMany({
      where: { workspaceId: w.id, deletedAt: null },
      include: { pillars: true, _count: { select: { ideas: true, contentItems: true } } },
    }),
  );
});
export const POST = apiHandler<{ workspaceSlug: string }>(async (req, { userId, params }) => {
  const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspacePermission(userId, w.id, "campaign:write");
  const body = schema.parse(await req.json());
  const brand = await prisma.brand.findFirstOrThrow({
    where: { id: body.brandId, workspaceId: w.id },
  });
  const campaign = await prisma.campaign.create({
    data: { ...body, workspaceId: w.id, brandId: brand.id, status: "DRAFT" },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: w.id,
      actorUserId: userId,
      action: "campaign.created",
      targetType: "Campaign",
      targetId: campaign.id,
    },
  });
  return NextResponse.json({ data: campaign }, { status: 201 });
});
