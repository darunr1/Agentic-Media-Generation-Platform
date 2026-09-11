import { notFound } from "next/navigation";
import {
  Activity,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileText,
} from "lucide-react";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Progress,
} from "@contentforge/ui";
import { formatCents } from "@contentforge/shared";
import { getDashboardStats } from "@/server/services/dashboard-service";
import { getWorkspaceContext } from "@/server/services/workspace-context";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-border/60 bg-card/60">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

const WORKFLOW_STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "secondary"
> = {
  SUCCEEDED: "success",
  RUNNING: "default",
  PENDING: "secondary",
  WAITING: "warning",
  FAILED: "destructive",
  DEAD_LETTER: "destructive",
  CANCELLED: "secondary",
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const stats = await getDashboardStats(ctx.workspace.id);
  const usagePct =
    stats.usage.contentItemsLimit > 0
      ? Math.min(
          100,
          Math.round((stats.usage.contentItemsUsed / stats.usage.contentItemsLimit) * 100),
        )
      : 0;
  const budgetPct =
    stats.usage.monthlyBudgetCents > 0
      ? Math.min(
          100,
          Math.round((stats.usage.spendCentsThisMonth / stats.usage.monthlyBudgetCents) * 100),
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Welcome back to {ctx.workspace.name}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Content generated (month)"
          value={stats.contentGeneratedThisMonth}
          icon={FileText}
        />
        <StatCard label="Awaiting approval" value={stats.awaitingApproval} icon={Clock3} />
        <StatCard
          label="Scheduled this week"
          value={stats.scheduledThisWeek}
          icon={CalendarClock}
        />
        <StatCard label="Published (month)" value={stats.publishedThisMonth} icon={CheckCircle2} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/60 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Usage this month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Content items</span>
                <span className="font-medium">
                  {stats.usage.contentItemsUsed} / {stats.usage.contentItemsLimit || "—"}
                </span>
              </div>
              <Progress value={usagePct} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estimated spend</span>
                <span className="font-medium">
                  {formatCents(stats.usage.spendCentsThisMonth)} /{" "}
                  {formatCents(stats.usage.monthlyBudgetCents)}
                </span>
              </div>
              <Progress value={budgetPct} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Recent workflow runs</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentWorkflowRuns.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No workflow runs yet"
                description="Generation and rendering jobs will show up here once you start a campaign."
              />
            ) : (
              <ul className="space-y-3">
                {stats.recentWorkflowRuns.map((run) => (
                  <li key={run.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {run.type.replaceAll("_", " ").toLowerCase()}
                    </span>
                    <Badge variant={WORKFLOW_STATUS_VARIANT[run.status] ?? "secondary"}>
                      {run.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Recent performance</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentPerformance.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No analytics yet"
                description="Once you publish content, platform analytics will appear here."
              />
            ) : (
              <ul className="space-y-3">
                {stats.recentPerformance.map((snapshot) => (
                  <li key={snapshot.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {snapshot.capturedAt.toLocaleDateString()}
                    </span>
                    <span className="font-medium">{snapshot.views ?? 0} views</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Estimated provider spend (month)</CardTitle>
          <DollarSign className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{formatCents(stats.estimatedProviderSpendCents)}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Tracked per AI/render/publish call — see Settings → Usage for a full breakdown.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
