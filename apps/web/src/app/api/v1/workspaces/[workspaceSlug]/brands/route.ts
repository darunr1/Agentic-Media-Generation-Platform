import { NextResponse } from "next/server";
import { z } from "zod";
import { assertWorkspaceMembership, assertWorkspacePermission } from "@contentforge/auth";
import { prisma } from "@contentforge/database";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
const createBrandSchema = z.object({
  name: z.string().min(2).max(120),
  industry: z.string().min(2).max(160),
  description: z.string().min(20).max(5000),
  productsServices: z.string().min(2).max(5000),
  targetCustomers: z.string().min(2).max(5000),
  geographicMarket: z.string().min(2).max(200),
});
export const GET = apiHandler<{ workspaceSlug: string }>(async (_req, { userId, params }) => {
  const workspace = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspaceMembership(userId, workspace.id);
  return jsonOk(
    await prisma.brand.findMany({
      where: { workspaceId: workspace.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        industry: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  );
});
export const POST = apiHandler<{ workspaceSlug: string }>(async (req, { userId, params }) => {
  const workspace = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspacePermission(userId, workspace.id, "brand:write");
  const body = createBrandSchema.parse(await req.json());
  const slug = body.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  const brand = await prisma.brand.create({
    data: { ...body, workspaceId: workspace.id, slug, status: "ONBOARDING" },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      actorUserId: userId,
      action: "brand.created",
      targetType: "Brand",
      targetId: brand.id,
    },
  });
  return NextResponse.json({ data: brand }, { status: 201 });
});
