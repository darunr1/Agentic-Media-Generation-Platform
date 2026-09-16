import { readJsonBody } from "@/server/api/handler";
import { assertWorkspacePermission } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
import { editContent } from "@/server/services/content-service";
export const PATCH = apiHandler<{ workspaceSlug: string; contentId: string }>(
  async (req, { userId, params }) => {
    const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
    await assertWorkspacePermission(userId, w.id, "content:write");
    return jsonOk(await editContent(w.id, userId!, params.contentId, await readJsonBody(req)));
  },
);
