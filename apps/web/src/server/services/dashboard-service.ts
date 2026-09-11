import { prisma } from "@contentforge/database";

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(now.getFullYear(), now.getMonth(), diff);
}

function endOfWeek(): Date {
  const start = startOfWeek();
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
}

export interface DashboardStats {
  contentGeneratedThisMonth: number;
  awaitingApproval: number;
  scheduledThisWeek: number;
  publishedThisMonth: number;
  usage: {
    contentItemsUsed: number;
    contentItemsLimit: number;
    monthlyBudgetCents: number;
    spendCentsThisMonth: number;
  };
  recentWorkflowRuns: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: Date;
    totalCostCents: number;
  }>;
  recentPerformance: Array<{
    id: string;
    capturedAt: Date;
    views: number | null;
    likes: number | null;
  }>;
  estimatedProviderSpendCents: number;
}

export async function getDashboardStats(workspaceId: string): Promise<DashboardStats> {
  const monthStart = startOfMonth();
  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();

  const [
    contentGeneratedThisMonth,
    awaitingApproval,
    scheduledThisWeek,
    publishedThisMonth,
    usageLimit,
    providerUsageAgg,
    recentWorkflowRuns,
    recentPerformance,
  ] = await Promise.all([
    prisma.contentItem.count({
      where: { workspaceId, createdAt: { gte: monthStart }, deletedAt: null },
    }),
    prisma.contentItem.count({
      where: { workspaceId, status: "AWAITING_REVIEW", deletedAt: null },
    }),
    prisma.contentItem.count({
      where: {
        workspaceId,
        status: "SCHEDULED",
        scheduledAt: { gte: weekStart, lt: weekEnd },
        deletedAt: null,
      },
    }),
    prisma.contentItem.count({
      where: {
        workspaceId,
        status: "PUBLISHED",
        updatedAt: { gte: monthStart },
        deletedAt: null,
      },
    }),
    prisma.usageLimit.findUnique({ where: { workspaceId } }),
    prisma.providerUsage.aggregate({
      where: { workspaceId, createdAt: { gte: monthStart } },
      _sum: { costCents: true },
    }),
    prisma.workflowRun.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        totalCostCents: true,
      },
    }),
    prisma.analyticsSnapshot.findMany({
      where: { workspaceId },
      orderBy: { capturedAt: "desc" },
      take: 3,
      select: { id: true, capturedAt: true, views: true, likes: true },
    }),
  ]);

  const spendCentsThisMonth = providerUsageAgg._sum.costCents ?? 0;

  return {
    contentGeneratedThisMonth,
    awaitingApproval,
    scheduledThisWeek,
    publishedThisMonth,
    usage: {
      contentItemsUsed: contentGeneratedThisMonth,
      contentItemsLimit: usageLimit?.contentItemsPerMonth ?? 0,
      monthlyBudgetCents: usageLimit?.monthlyBudgetCents ?? 0,
      spendCentsThisMonth,
    },
    recentWorkflowRuns,
    recentPerformance,
    estimatedProviderSpendCents: spendCentsThisMonth,
  };
}
