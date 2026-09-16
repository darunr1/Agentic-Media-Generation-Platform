import { hasPermission } from "@contentforge/auth";
import { ReviewActions } from "@/components/product/workflow-actions";
import { notFound } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { prisma } from "@contentforge/database";
import { Badge, Card, CardContent } from "@contentforge/ui";
import { LocalObjectStorageProvider, localStorageRoot } from "@contentforge/media";
import { PageHeading } from "@/components/product/page-heading";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const requests = await prisma.approvalRequest.findMany({
    where: { workspaceId: ctx.workspace.id },
    include: {
      contentItem: {
        include: {
          variants: {
            where: { isPrimary: true, deletedAt: null },
            include: {
              renderJobs: {
                where: { status: "SUCCEEDED" },
                orderBy: { createdAt: "desc" },
                take: 1,
                include: { outputs: true },
              },
            },
          },
        },
      },
      decisions: { include: { decidedBy: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const storage = new LocalObjectStorageProvider(localStorageRoot());
  const previews = new Map(
    await Promise.all(
      requests.map(async (request) => {
        const key = request.contentItem.variants[0]?.renderJobs[0]?.outputs[0]?.storageKey;
        return [request.id, key ? await storage.createSignedDownloadUrl(key, 3600) : null] as const;
      }),
    ),
  );
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Human-in-the-loop"
        title="Approval queue"
        description="Publishing is blocked by default until a reviewer checks copy, media, compliance, and destination readiness."
      />
      {requests.map((request) => {
        const variant = request.contentItem.variants[0];
        const decision = request.decisions[0];
        return (
          <Card key={request.id}>
            <CardContent className="grid gap-6 p-6 lg:grid-cols-[220px_1fr]">
              <div>
                {previews.get(request.id) ? (
                  <video
                    className="w-full rounded-xl"
                    aria-label={`Review preview: ${request.contentItem.title}`}
                    src={previews.get(request.id)!}
                    controls
                    preload="metadata"
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">No rendered preview available.</p>
                )}
                <p className="mt-3 text-sm">{variant?.captionText}</p>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={request.status === "APPROVED" ? "success" : "warning"}>
                    {request.status}
                  </Badge>
                  <Badge variant="outline">{variant?.platform}</Badge>
                </div>
                <h2 className="mt-4 text-xl font-semibold">{request.contentItem.title}</h2>
                <p className="mt-3 text-sm">
                  Compliance:{" "}
                  {request.contentItem.complianceAcknowledged ? "Acknowledged" : "Review required"}
                </p>
                <a
                  className="text-primary mt-3 inline-block text-sm underline"
                  href={`/w/${workspaceSlug}/studio?contentId=${request.contentItemId}`}
                >
                  Preview video and compare versions
                </a>
                {request.status === "PENDING" &&
                  request.contentItem.status === "AWAITING_REVIEW" &&
                  hasPermission(ctx.role, "content:approve") && (
                    <ReviewActions workspaceSlug={workspaceSlug} requestId={request.id} />
                  )}
                {decision && (
                  <div className="bg-secondary/30 mt-5 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="text-primary size-4" />
                      <p className="font-medium">
                        Reviewed by{" "}
                        {decision.decidedBy?.name ??
                          decision.decidedByExternalName ??
                          "Client reviewer"}
                      </p>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">{decision.notes}</p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {decision.createdAt.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
