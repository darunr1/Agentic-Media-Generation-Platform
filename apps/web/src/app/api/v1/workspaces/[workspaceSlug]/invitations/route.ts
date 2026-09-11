import { z } from "zod";

import { assertWorkspacePermission } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
import { inviteMember, listPendingInvitations } from "@/server/services/team-service";

const inviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["ADMIN", "EDITOR", "REVIEWER", "VIEWER"]),
});

export const GET = apiHandler<{ workspaceSlug: string }>(async (_req, { userId, params }) => {
  const workspace = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspacePermission(userId, workspace.id, "team:manage");
  return jsonOk(await listPendingInvitations(workspace.id));
});

export const POST = apiHandler<{ workspaceSlug: string }>(async (req, { userId, params }) => {
  const workspace = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspacePermission(userId, workspace.id, "team:manage");
  const body = inviteSchema.parse(await req.json());
  const invitation = await inviteMember({
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    invitedByUserId: userId!,
    email: body.email,
    role: body.role,
  });
  return jsonOk(invitation, 201);
});
