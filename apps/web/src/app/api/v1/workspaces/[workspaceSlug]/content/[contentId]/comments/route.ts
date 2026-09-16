import { readJsonBody } from "@/server/api/handler";
import { z } from "zod";
import { prisma } from "@contentforge/database";
import { assertWorkspacePermission } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
import { NotFoundError } from "@contentforge/shared";
export const POST = apiHandler<{ workspaceSlug: string; contentId: string }>(
  async (req, { userId, params }) => {
    const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
    await assertWorkspacePermission(userId, w.id, "content:comment");
    const body = z
      .object({ body: z.string().trim().min(1).max(5000) })
      .parse(await readJsonBody(req));
    if (
      !(await prisma.contentItem.findFirst({
        where: { id: params.contentId, workspaceId: w.id, deletedAt: null },
      }))
    )
      throw new NotFoundError("Content");
    return jsonOk(
      await prisma.contentComment.create({
        data: {
          workspaceId: w.id,
          contentItemId: params.contentId,
          authorUserId: userId,
          body: body.body,
        },
      }),
      201,
    );
  },
);
