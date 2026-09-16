import { prisma } from "@contentforge/database";
import { assertWorkspaceMembership, assertWorkspacePermission } from "@contentforge/auth";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
import { cancelWorkflow } from "@contentforge/workflows";
import { NotFoundError } from "@contentforge/shared";
export const GET = apiHandler<{ workspaceSlug: string; runId: string }>(
  async (_req, { userId, params }) => {
    const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
    await assertWorkspaceMembership(userId, w.id);
    const run = await prisma.workflowRun.findFirst({
      where: { id: params.runId, workspaceId: w.id },
      include: {
        steps: { orderBy: { sequenceNumber: "asc" } },
        tasks: {
          select: {
            id: true,
            type: true,
            status: true,
            attemptCount: true,
            maxAttempts: true,
            lastError: true,
            scheduledAt: true,
          },
        },
      },
    });
    if (!run) throw new NotFoundError("Workflow");
    return jsonOk(run);
  },
);
export const DELETE = apiHandler<{ workspaceSlug: string; runId: string }>(
  async (_req, { userId, params }) => {
    const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
    await assertWorkspacePermission(userId, w.id, "content:generate");
    return jsonOk(await cancelWorkflow(w.id, params.runId, userId!));
  },
);
