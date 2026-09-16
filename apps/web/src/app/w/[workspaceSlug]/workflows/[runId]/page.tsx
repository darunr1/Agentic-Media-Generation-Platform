import { notFound } from "next/navigation";
import { prisma } from "@contentforge/database";
import { hasPermission } from "@contentforge/auth";
import { WorkflowTimeline, type RunView } from "@/components/product/workflow-timeline";
import { PageHeading } from "@/components/product/page-heading";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; runId: string }>;
}) {
  const { workspaceSlug, runId } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const run = await prisma.workflowRun.findFirst({
    where: { id: runId, workspaceId: ctx.workspace.id },
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
        },
      },
    },
  });
  if (!run) notFound();
  return (
    <div className="space-y-6">
      <PageHeading title="Workflow run" description={run.type.replaceAll("_", " ")} />
      <WorkflowTimeline
        initial={JSON.parse(JSON.stringify(run)) as RunView}
        workspaceSlug={workspaceSlug}
        canCancel={hasPermission(
          ctx.role,
          run.type === "PUBLISH" || run.type === "ANALYTICS_COLLECTION"
            ? "publish:execute"
            : "content:generate",
        )}
      />
    </div>
  );
}
