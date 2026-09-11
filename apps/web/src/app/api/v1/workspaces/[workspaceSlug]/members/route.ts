import { assertWorkspaceMembership } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
import { listMembers } from "@/server/services/team-service";

export const GET = apiHandler<{ workspaceSlug: string }>(async (_req, { userId, params }) => {
  const workspace = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspaceMembership(userId, workspace.id);
  const members = await listMembers(workspace.id);
  return jsonOk(members);
});
