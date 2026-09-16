import { readJsonBody } from "@/server/api/handler";
import { saveBrand } from "@/server/services/planning-service";
import { assertWorkspaceMembership, assertWorkspacePermission } from "@contentforge/auth";
import { prisma } from "@contentforge/database";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
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
  const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspacePermission(userId, w.id, "brand:write");
  return jsonOk(await saveBrand(w.id, userId!, await readJsonBody(req)), 201);
});
