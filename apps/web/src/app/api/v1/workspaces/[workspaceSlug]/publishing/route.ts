import { readJsonBody } from "@/server/api/handler";
import { z } from "zod";
import { assertWorkspacePermission } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
import { scheduleOrPublish } from "@/server/services/publishing-service";
const schema = z.object({
  contentItemId: z.string().min(1),
  socialAccountId: z.string().min(1),
  scheduledAt: z.coerce.date(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});
export const POST = apiHandler<{ workspaceSlug: string }>(
  async (req, { userId, params, requestId }) => {
    const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
    await assertWorkspacePermission(userId, w.id, "publish:execute");
    const body = schema.parse(await readJsonBody(req));
    return jsonOk(
      await scheduleOrPublish({
        ...body,
        workspaceId: w.id,
        userId: userId!,
        idempotencyKey: req.headers.get("idempotency-key") ?? body.idempotencyKey ?? requestId,
      }),
      201,
    );
  },
);
