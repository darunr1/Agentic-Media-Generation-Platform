import { readJsonBody } from "@/server/api/handler";
import { z } from "zod";

import { listUserWorkspaceMemberships } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { createWorkspace } from "@/server/services/workspace-service";

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const POST = apiHandler(async (req, { userId }) => {
  const body = createWorkspaceSchema.parse(await readJsonBody(req));
  const workspace = await createWorkspace({ userId: userId!, name: body.name });
  return jsonOk(workspace, 201);
});

export const GET = apiHandler(async (_req, { userId }) => {
  const memberships = await listUserWorkspaceMemberships(userId!);
  return jsonOk(
    memberships.map((m) => ({
      workspace: m.workspace,
      role: m.role,
    })),
  );
});
