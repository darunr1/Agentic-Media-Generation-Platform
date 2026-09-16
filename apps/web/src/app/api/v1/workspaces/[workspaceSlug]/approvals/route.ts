import { readJsonBody } from "@/server/api/handler";
import { decideApproval } from "@contentforge/workflows";
import { z } from "zod";
import { assertWorkspaceMembership, assertWorkspacePermission } from "@contentforge/auth";
import { prisma } from "@contentforge/database";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
const schema = z.object({
  approvalRequestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
  notes: z.string().max(5000).optional(),
});
export const GET = apiHandler<{ workspaceSlug: string }>(async (_req, { userId, params }) => {
  const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspaceMembership(userId, w.id);
  return jsonOk(
    await prisma.approvalRequest.findMany({
      where: { workspaceId: w.id },
      include: {
        contentItem: { select: { id: true, title: true, status: true } },
        decisions: {
          select: {
            id: true,
            decision: true,
            notes: true,
            createdAt: true,
            decidedBy: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
});
export const POST = apiHandler<{ workspaceSlug: string }>(async (req, { userId, params }) => {
  const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspacePermission(userId, w.id, "content:approve");
  const body = schema
    .extend({ complianceAcknowledged: z.boolean().optional() })
    .parse(await readJsonBody(req));
  return jsonOk(await decideApproval({ ...body, workspaceId: w.id, userId: userId! }), 201);
});
