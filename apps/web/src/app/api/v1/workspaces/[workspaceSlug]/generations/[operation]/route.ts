import { readJsonBody } from "@/server/api/handler";
import { z } from "zod";
import { assertWorkspacePermission } from "@contentforge/auth";
import { startGeneration } from "@contentforge/workflows";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
export const POST = apiHandler<{ workspaceSlug: string; operation: string }>(
  async (req, { userId, params, requestId }) => {
    const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
    await assertWorkspacePermission(userId, w.id, "content:generate");
    const operation = z.enum(["strategy", "ideas", "script"]).parse(params.operation);
    const body = z
      .object({
        campaignId: z.string().max(128).optional(),
        contentItemId: z.string().max(128).optional(),
        preserveScript: z.boolean().optional(),
        idempotencyKey: z.string().min(8).max(128).optional(),
      })
      .parse(await readJsonBody(req));
    const idempotencyKey = z
      .string()
      .min(8)
      .max(128)
      .parse(req.headers.get("idempotency-key") ?? body.idempotencyKey ?? requestId);
    return jsonOk(
      await startGeneration({
        ...body,
        operation,
        workspaceId: w.id,
        userId: userId!,
        idempotencyKey,
      }),
      202,
    );
  },
);
