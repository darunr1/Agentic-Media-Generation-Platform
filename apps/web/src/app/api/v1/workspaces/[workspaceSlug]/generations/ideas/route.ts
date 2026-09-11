import { z } from "zod";
import { assertWorkspacePermission } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
import { generateCampaignIdeas } from "@/server/services/generation-service";
const schema = z.object({
  campaignId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(128).optional(),
});
export const POST = apiHandler<{ workspaceSlug: string }>(
  async (req, { userId, params, requestId }) => {
    const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
    await assertWorkspacePermission(userId, w.id, "content:generate");
    const body = schema.parse(await req.json());
    return jsonOk(
      await generateCampaignIdeas({
        workspaceId: w.id,
        campaignId: body.campaignId,
        userId: userId!,
        idempotencyKey: req.headers.get("idempotency-key") ?? body.idempotencyKey ?? requestId,
      }),
      201,
    );
  },
);
