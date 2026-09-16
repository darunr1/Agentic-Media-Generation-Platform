import { readJsonBody } from "@/server/api/handler";
import { z } from "zod";

import { assertWorkspacePermission } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
import { renameWorkspace, softDeleteWorkspace } from "@/server/services/workspace-service";

const renameSchema = z.object({ name: z.string().trim().min(2).max(80) });

export const PATCH = apiHandler<{ workspaceSlug: string }>(async (req, { userId, params }) => {
  const workspace = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspacePermission(userId, workspace.id, "settings:write");
  const body = renameSchema.parse(await readJsonBody(req));
  const updated = await renameWorkspace(workspace.id, body.name, userId!);
  return jsonOk(updated);
});

export const DELETE = apiHandler<{ workspaceSlug: string }>(async (_req, { userId, params }) => {
  const workspace = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspacePermission(userId, workspace.id, "workspace:manage");
  await softDeleteWorkspace(workspace.id, userId!);
  return jsonOk({ deleted: true });
});
