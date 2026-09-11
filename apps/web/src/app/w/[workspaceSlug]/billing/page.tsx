import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, CreditCard } from "lucide-react";
import { prisma } from "@contentforge/database";
import { Badge, Card, CardContent, CardHeader, CardTitle, Progress } from "@contentforge/ui";
import { formatCents } from "@contentforge/shared";
import { PageHeading } from "@/components/product/page-heading";
import { getWorkspaceContext } from "@/server/services/workspace-context";
export default async function BillingPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  const [subscription, limit, events] = await Promise.all([
    prisma.subscription.findUnique({
      where: { workspaceId: ctx.workspace.id },
      include: { plan: true },
    }),
    prisma.usageLimit.findUnique({ where: { workspaceId: ctx.workspace.id } }),
    prisma.usageEvent.aggregate({
      where: { workspaceId: ctx.workspace.id },
      _sum: { quantity: true, costCents: true },
    }),
  ]);
  if (!subscription || !limit) return <p>Billing configuration missing.</p>;
  const used = events._sum.quantity ?? 0;
  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Billing & safeguards"
        title="Plan and usage"
        description="Trial status, feature limits, workspace budget, metered usage, and provider costs are enforced on the server before work begins."
      />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <Badge variant="success">{subscription.status}</Badge>
              <CardTitle className="mt-3">{subscription.plan.name}</CardTitle>
            </div>
            <CreditCard className="text-primary size-5" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {formatCents(subscription.plan.monthlyPriceCents)}
              <span className="text-muted-foreground text-sm font-normal"> / month</span>
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                `${limit.contentItemsPerMonth} content items / month`,
                `${limit.socialConnectionsLimit} social connection`,
                `${limit.brandsLimit} brand`,
                `Human approval included`,
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  {item}
                </div>
              ))}
            </div>
            {subscription.trialEndsAt && (
              <p className="text-muted-foreground mt-6 text-xs">
                Trial ends {subscription.trialEndsAt.toLocaleDateString()}.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monthly safeguards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Usage
              label="Content usage"
              current={Math.min(used, limit.contentItemsPerMonth)}
              limit={limit.contentItemsPerMonth}
            />
            <Usage
              label="Provider spend"
              current={events._sum.costCents ?? 0}
              limit={limit.monthlyBudgetCents}
              money
            />
            <div className="flex gap-2 rounded-lg bg-amber-400/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                Stripe checkout and portal are setup-ready but disabled until test-mode credentials
                and price IDs are configured.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
function Usage({
  label,
  current,
  limit,
  money = false,
}: {
  label: string;
  current: number;
  limit: number;
  money?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span>
          {money ? `${formatCents(current)} / ${formatCents(limit)}` : `${current} / ${limit}`}
        </span>
      </div>
      <Progress value={Math.min(100, (current / Math.max(limit, 1)) * 100)} />
    </div>
  );
}
