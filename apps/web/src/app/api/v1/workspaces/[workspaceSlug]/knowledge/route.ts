import { NextResponse } from "next/server";
import { z } from "zod";
import { assertWorkspaceMembership, assertWorkspacePermission } from "@contentforge/auth";
import { prisma } from "@contentforge/database";
import { apiHandler, jsonOk } from "@/server/api/handler";
import { resolveWorkspaceOrThrow } from "@/server/api/workspace-params";
import { importPublicWebpage } from "@/server/services/web-import-service";
const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("MANUAL_TEXT"),
    brandId: z.string().min(1),
    title: z.string().min(1).max(160),
    text: z.string().min(1).max(100_000),
  }),
  z.object({
    type: z.literal("URL"),
    brandId: z.string().min(1),
    title: z.string().min(1).max(160),
    url: z.string().url().max(2000),
  }),
]);
export const GET = apiHandler<{ workspaceSlug: string }>(async (_req, { userId, params }) => {
  const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspaceMembership(userId, w.id);
  return jsonOk(
    await prisma.knowledgeSource.findMany({
      where: { workspaceId: w.id, deletedAt: null },
      select: {
        id: true,
        brandId: true,
        type: true,
        status: true,
        title: true,
        sourceUrl: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { chunks: true } },
      },
    }),
  );
});
export const POST = apiHandler<{ workspaceSlug: string }>(async (req, { userId, params }) => {
  const w = await resolveWorkspaceOrThrow(params.workspaceSlug);
  await assertWorkspacePermission(userId, w.id, "brand:write");
  const body = schema.parse(await req.json());
  const brand = await prisma.brand.findFirstOrThrow({
    where: { id: body.brandId, workspaceId: w.id },
  });
  const imported =
    body.type === "URL"
      ? await importPublicWebpage(body.url)
      : { sourceUrl: undefined, extractedText: body.text };
  const source = await prisma.knowledgeSource.create({
    data: {
      workspaceId: w.id,
      brandId: brand.id,
      type: body.type,
      status: "READY",
      title: body.title,
      sourceUrl: imported.sourceUrl,
      extractedText: imported.extractedText,
      chunks: {
        create: {
          brandId: brand.id,
          chunkIndex: 0,
          content: imported.extractedText.slice(0, 20_000),
          embedding: [],
          tokenCount: Math.ceil(imported.extractedText.length / 4),
        },
      },
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: w.id,
      actorUserId: userId,
      action: "knowledge.source.created",
      targetType: "KnowledgeSource",
      targetId: source.id,
      metadata: { type: body.type, contentLength: imported.extractedText.length },
    },
  });
  return NextResponse.json(
    {
      data: {
        id: source.id,
        title: source.title,
        type: source.type,
        status: source.status,
        sourceUrl: source.sourceUrl,
      },
    },
    { status: 201 },
  );
});
