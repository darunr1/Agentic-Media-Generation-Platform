import { apiHandler, jsonOk } from "@/server/api/handler";
import { acceptInvitation } from "@/server/services/team-service";

export const POST = apiHandler<{ token: string }>(async (_req, { userId, params }) => {
  const workspace = await acceptInvitation(params.token, userId!);
  return jsonOk({ workspaceSlug: workspace.slug });
});
