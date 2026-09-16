import { notFound } from "next/navigation";
import { prisma } from "@contentforge/database";
import { getWorkspaceContext } from "@/server/services/workspace-context";
import { PageHeading } from "@/components/product/page-heading";
export default async function WorkflowsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const runs = await prisma.workflowRun.findMany({
    where: { workspaceId: ctx.workspace.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div className="space-y-4">
      <PageHeading
        title="Workflow runs"
        description="Persisted agent handoffs, task retries, rendering and publishing."
      />
      {runs.map((r) => (
        <a
          key={r.id}
          className="block rounded-xl border p-4"
          href={`/w/${workspaceSlug}/workflows/${r.id}`}
        >
          {r.type} / {r.status} / {r.createdAt.toLocaleString()}
        </a>
      ))}
    </div>
  );
}
