import { readJsonBody } from "@/server/api/handler";
import { saveCampaign } from "@/server/services/planning-service";
import { assertWorkspaceMembership, assertWorkspacePermission } from "@contentforge/auth";
import { prisma } from "@contentforge/database";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
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
  return jsonOk(await saveCampaign(w.id, userId!, await readJsonBody(req)), 201);
});
