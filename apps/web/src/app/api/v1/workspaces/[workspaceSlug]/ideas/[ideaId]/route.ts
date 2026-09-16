import { readJsonBody } from "@/server/api/handler";
import { z } from "zod";
import { assertWorkspacePermission } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
import { decideIdea } from "@/server/services/content-service";
export const PATCH = apiHandler<{ workspaceSlug: string; ideaId: string }>(
  async (req, { userId, params }) => {
    const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
    await assertWorkspacePermission(userId, w.id, "content:write");
    const body = z
      .object({ status: z.enum(["ACCEPTED", "REJECTED"]) })
      .parse(await readJsonBody(req));
    return jsonOk(await decideIdea(w.id, userId!, params.ideaId, body.status));
  },
);
