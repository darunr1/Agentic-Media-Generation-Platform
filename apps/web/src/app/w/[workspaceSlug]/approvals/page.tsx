import { notFound } from "next/navigation";
import { CheckCircle2, Clock3, MessageSquareText, ShieldCheck } from "lucide-react";
import { prisma } from "@contentforge/database";
import { Badge, Card, CardContent } from "@contentforge/ui";
import { ContentPreview } from "@/components/product/content-preview";
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
      contentItem: { include: { variants: true } },
      decisions: { include: { decidedBy: true } },
    },
    orderBy: { createdAt: "desc" },
  });
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
              <ContentPreview
                title={request.contentItem.title}
                caption={variant?.captionText ?? "Preview caption"}
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={request.status === "APPROVED" ? "success" : "warning"}>
                    {request.status}
                  </Badge>
                  <Badge variant="outline">{variant?.platform}</Badge>
                </div>
                <h2 className="mt-4 text-xl font-semibold">{request.contentItem.title}</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Check icon={ShieldCheck} label="Compliance acknowledged" />
                  <Check icon={CheckCircle2} label="Assets complete" />
                  <Check icon={Clock3} label="Connection active" />
                </div>
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
function Check({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
      <Icon className="size-4" />
      {label}
    </div>
  );
}
