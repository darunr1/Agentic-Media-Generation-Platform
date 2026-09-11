import { notFound } from "next/navigation";
import { Activity, Database, Flag, HeartPulse, Search, Users } from "lucide-react";
import { auth } from "@contentforge/auth";
import { prisma } from "@contentforge/database";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@contentforge/ui";
import { PageHeading } from "@/components/product/page-heading";
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPlatformAdmin: true },
  });
  if (!admin?.isPlatformAdmin) notFound();
  const [users, workspaces, failed, flags, usage] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.workspace.findMany({
      where: { deletedAt: null },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { memberships: true, contentItems: true } },
      },
      take: 20,
    }),
    prisma.workflowRun.findMany({
      where: { status: { in: ["FAILED", "DEAD_LETTER"] } },
      take: 20,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.featureFlag.findMany({ take: 20 }),
    prisma.providerUsage.aggregate({ _sum: { costCents: true, durationMs: true } }),
  ]);
  return (
    <main className="min-h-screen p-6 sm:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeading
          eyebrow="Platform administration"
          title="Operations console"
          description="Search tenants, inspect subscriptions and failed jobs, monitor provider spend and health, manage flags, and review audit trails."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Users} label="Users" value={users} />
          <Stat icon={Database} label="Workspaces" value={workspaces.length} />
          <Stat icon={Activity} label="Failed jobs" value={failed.length} />
          <Stat icon={Flag} label="Feature flags" value={flags.length} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="size-4" />
                Workspace & subscription inspection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-border divide-y">
                {workspaces.map((w) => (
                  <li key={w.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{w.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {w._count.memberships} members · {w._count.contentItems} items
                      </p>
                    </div>
                    <Badge
                      variant={
                        w.subscription?.status === "ACTIVE" || w.subscription?.status === "TRIALING"
                          ? "success"
                          : "warning"
                      }
                    >
                      {w.subscription?.plan.name ?? "No plan"} ·{" "}
                      {w.subscription?.status ?? "MISSING"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HeartPulse className="size-4" />
                Provider health & cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <Badge variant="success">Healthy</Badge>
                <p className="mt-3 font-medium">Local provider stack</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Mock AI, local storage, local queue, console email, mock social
                </p>
              </div>
              <p className="text-muted-foreground mt-5 text-sm">
                Recorded provider cost: ${(usage._sum.costCents ?? 0) / 100} · duration:{" "}
                {usage._sum.durationMs ?? 0} ms
              </p>
            </CardContent>
          </Card>
        </div>
        {failed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Failed workflow queue</CardTitle>
            </CardHeader>
            <CardContent>
              {failed.map((run) => (
                <div key={run.id}>
                  {run.id} · {run.type} · {run.status}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <Icon className="text-primary mb-3 size-5" />
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
