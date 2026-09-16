import { readJsonBody } from "@/server/api/handler";
import { saveBrand, archiveBrand } from "@/server/services/planning-service";
import { assertWorkspacePermission } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
export const PATCH = apiHandler<{ workspaceSlug: string; brandId: string }>(
  async (req, { userId, params }) => {
    const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
    await assertWorkspacePermission(userId, w.id, "brand:write");
    return jsonOk(await saveBrand(w.id, userId!, await readJsonBody(req), params.brandId));
  },
);
export const DELETE = apiHandler<{ workspaceSlug: string; brandId: string }>(
  async (_req, { userId, params }) => {
    const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
    await assertWorkspacePermission(userId, w.id, "brand:write");
    return jsonOk(await archiveBrand(w.id, userId!, params.brandId));
  },
);
