import { assertWorkspacePermission } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
import { removeMember } from "@/server/services/team-service";

export const DELETE = apiHandler<{
  workspaceSlug: string;
  membershipId: string;
}>(async (_req, { userId, params }) => {
  const workspace = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspacePermission(userId, workspace.id, "team:manage");
  await removeMember(workspace.id, params.membershipId, userId!);
  return jsonOk({ removed: true });
});
