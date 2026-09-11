import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from "@contentforge/ui";
import { formatCents } from "@contentforge/shared";
import { hasPermission as hasAuthPermission } from "@contentforge/auth";
import { DangerZone } from "@/components/settings/danger-zone";
import { RenameWorkspaceForm } from "@/components/settings/rename-workspace-form";
import { getDashboardStats } from "@/server/services/dashboard-service";
import { getWorkspaceContext } from "@/server/services/workspace-context";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const canWrite = hasAuthPermission(ctx.role, "settings:write");
  const canManageWorkspace = hasAuthPermission(ctx.role, "workspace:manage");
  const stats = canWrite ? await getDashboardStats(ctx.workspace.id) : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Workspace configuration for {ctx.workspace.name}.
        </p>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription>
            The workspace name is shown throughout the product and in the switcher.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RenameWorkspaceForm
            workspaceSlug={workspaceSlug}
            initialName={ctx.workspace.name}
            disabled={!canWrite}
          />
        </CardContent>
      </Card>

      {stats ? (
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Usage this month</CardTitle>
            <CardDescription>
              Content items and spend counted against your plan&apos;s limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Content items</span>
                <span className="font-medium">
                  {stats.usage.contentItemsUsed} / {stats.usage.contentItemsLimit || "—"}
                </span>
              </div>
              <Progress
                value={
                  stats.usage.contentItemsLimit > 0
                    ? Math.min(
                        100,
                        (stats.usage.contentItemsUsed / stats.usage.contentItemsLimit) * 100,
                      )
                    : 0
                }
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Provider spend</span>
                <span className="font-medium">
                  {formatCents(stats.usage.spendCentsThisMonth)} /{" "}
                  {formatCents(stats.usage.monthlyBudgetCents)}
                </span>
              </div>
              <Progress
                value={
                  stats.usage.monthlyBudgetCents > 0
                    ? Math.min(
                        100,
                        (stats.usage.spendCentsThisMonth / stats.usage.monthlyBudgetCents) * 100,
                      )
                    : 0
                }
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canManageWorkspace ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive text-base">Danger zone</CardTitle>
            <CardDescription>
              Deleting a workspace immediately revokes access for every member. Data is retained for
              a grace period before permanent removal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DangerZone workspaceSlug={workspaceSlug} workspaceName={ctx.workspace.name} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
