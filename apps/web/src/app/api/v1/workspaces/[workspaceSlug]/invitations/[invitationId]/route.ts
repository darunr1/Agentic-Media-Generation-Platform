import { assertWorkspacePermission } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
import { revokeInvitation } from "@/server/services/team-service";

export const DELETE = apiHandler<{
  workspaceSlug: string;
  invitationId: string;
}>(async (_req, { userId, params }) => {
  const workspace = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspacePermission(userId, workspace.id, "team:manage");
  await revokeInvitation(workspace.id, params.invitationId, userId!);
  return jsonOk({ revoked: true });
});
