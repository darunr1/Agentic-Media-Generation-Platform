import { notFound } from "next/navigation";
import { Activity, CheckCircle2, CircleDollarSign, RotateCcw } from "lucide-react";
import { prisma } from "@contentforge/database";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@contentforge/ui";
import { formatCents } from "@contentforge/shared";
import { PageHeading } from "@/components/product/page-heading";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function ActivityPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const [runs, logs, usage] = await Promise.all([
    prisma.workflowRun.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: { steps: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.auditLog.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.providerUsage.aggregate({
      where: { workspaceId: ctx.workspace.id },
      _sum: { costCents: true, durationMs: true },
    }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Operations"
        title="Workflow & audit activity"
        description="Every step is persisted with idempotency, retry, cost, timing, input/output, cancellation, and dead-letter visibility."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <Activity className="text-primary mb-3 size-5" />
            <p className="text-muted-foreground text-xs">Workflow runs</p>
            <p className="mt-1 text-2xl font-semibold">{runs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <CircleDollarSign className="text-primary mb-3 size-5" />
            <p className="text-muted-foreground text-xs">Provider spend</p>
            <p className="mt-1 text-2xl font-semibold">{formatCents(usage._sum.costCents ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <RotateCcw className="text-primary mb-3 size-5" />
            <p className="text-muted-foreground text-xs">Dead-letter jobs</p>
            <p className="mt-1 text-2xl font-semibold">
              {runs.filter((r) => r.status === "DEAD_LETTER").length}
            </p>
          </CardContent>
        </Card>
      </div>
      {runs.map((run) => (
        <Card key={run.id}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{run.type.replaceAll("_", " ")}</CardTitle>
            <Badge
              variant={
                run.status === "SUCCEEDED"
                  ? "success"
                  : run.status === "FAILED"
                    ? "destructive"
                    : "secondary"
              }
            >
              {run.status}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-5">
              {run.steps
                .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
                .map((step) => (
                  <div key={step.id} className="rounded-lg border p-3">
                    <CheckCircle2 className="mb-2 size-4 text-emerald-400" />
                    <p className="text-xs font-medium capitalize">{step.name}</p>
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      {step.retryCount} retries · {formatCents(step.costCents)}
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-border divide-y">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <p>{log.action.replaceAll(".", " · ")}</p>
                  <p className="text-muted-foreground text-xs">
                    {log.targetType}
                    {log.targetId ? ` · ${log.targetId.slice(0, 8)}` : ""}
                  </p>
                </div>
                <time className="text-muted-foreground whitespace-nowrap text-xs">
                  {log.createdAt.toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
