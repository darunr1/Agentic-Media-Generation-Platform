import { NextResponse } from "next/server";
import { z } from "zod";
import { assertWorkspaceMembership, assertWorkspacePermission } from "@contentforge/auth";
import { prisma } from "@contentforge/database";
import { NotFoundError } from "@contentforge/shared";
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
  const body = schema.parse(await req.json());
  const request = await prisma.approvalRequest.findFirst({
    where: { id: body.approvalRequestId, workspaceId: w.id },
  });
  if (!request) throw new NotFoundError("Approval request", body.approvalRequestId);
  const status = body.decision;
  const contentStatus =
    status === "APPROVED"
      ? "APPROVED"
      : status === "CHANGES_REQUESTED"
        ? "CHANGES_REQUESTED"
        : "DRAFT";
  const decision = await prisma.$transaction(async (tx) => {
    const created = await tx.approvalDecision.create({
      data: {
        approvalRequestId: request.id,
        decidedByUserId: userId,
        decision: body.decision,
        notes: body.notes,
      },
    });
    await tx.approvalRequest.update({ where: { id: request.id }, data: { status } });
    await tx.contentItem.update({
      where: { id: request.contentItemId },
      data: { status: contentStatus },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: w.id,
        actorUserId: userId,
        action: `content.review.${body.decision.toLowerCase()}`,
        targetType: "ContentItem",
        targetId: request.contentItemId,
        metadata: { approvalRequestId: request.id },
      },
    });
    return created;
  });
  return NextResponse.json({ data: decision }, { status: 201 });
});
