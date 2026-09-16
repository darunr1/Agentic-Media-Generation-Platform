import { readJsonBody } from "@/server/api/handler";
import { saveCampaign } from "@/server/services/planning-service";
import { assertWorkspacePermission } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
export const PATCH = apiHandler<{ workspaceSlug: string; campaignId: string }>(
  async (req, { userId, params }) => {
    const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
    await assertWorkspacePermission(userId, w.id, "campaign:write");
    return jsonOk(await saveCampaign(w.id, userId!, await readJsonBody(req), params.campaignId));
  },
);
