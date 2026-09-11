/**
 * Canonical plan catalog — brief §2. This is the single source of truth for
 * plan pricing/limits used by the marketing pricing page, the database seed
 * script (which writes these into the `Plan` table, since "plans and limits
 * are data, not hard-coded constants" per ARCHITECTURE.md ADR), and
 * packages/billing's usage-limit enforcement defaults. Changing a limit here
 * only affects display copy and seed defaults — the live source of truth at
 * runtime is always the `Plan`/`UsageLimit` database rows so an admin can
 * override a single workspace without a deploy.
 */
export interface PlanDefinition {
  key: "starter" | "growth" | "agency";
  name: string;
  monthlyPriceCents: number;
  contentItemsPerMonth: number;
  socialConnectionsLimit: number;
  brandsLimit: number;
  teamMembersLimit: number;
  hasAnalytics: boolean;
  hasCalendar: boolean;
  hasCustomTemplates: boolean;
  hasClientApprovalLinks: boolean;
  priorityRendering: boolean;
  tagline: string;
  highlights: string[];
}

export const PLAN_CATALOG: readonly PlanDefinition[] = [
  {
    key: "starter",
    name: "Starter",
    monthlyPriceCents: 4900,
    contentItemsPerMonth: 12,
    socialConnectionsLimit: 1,
    brandsLimit: 1,
    teamMembersLimit: 1,
    hasAnalytics: false,
    hasCalendar: false,
    hasCustomTemplates: false,
    hasClientApprovalLinks: false,
    priorityRendering: false,
    tagline: "One brand, a steady drumbeat of content, human-reviewed.",
    highlights: [
      "1 brand",
      "12 content items / month",
      "1 social connection",
      "Basic rendering",
      "Human approval queue",
      "Email support",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    monthlyPriceCents: 14900,
    contentItemsPerMonth: 30,
    socialConnectionsLimit: 5,
    brandsLimit: 1,
    teamMembersLimit: 3,
    hasAnalytics: true,
    hasCalendar: true,
    hasCustomTemplates: true,
    hasClientApprovalLinks: false,
    priorityRendering: true,
    tagline: "For a business posting daily across multiple platforms.",
    highlights: [
      "1 brand",
      "30 content items / month",
      "Multiple social connections",
      "Analytics & content calendar",
      "Custom brand render templates",
      "Priority rendering",
    ],
  },
  {
    key: "agency",
    name: "Agency",
    monthlyPriceCents: 39900,
    contentItemsPerMonth: 120,
    socialConnectionsLimit: 20,
    brandsLimit: 10,
    teamMembersLimit: 10,
    hasAnalytics: true,
    hasCalendar: true,
    hasCustomTemplates: true,
    hasClientApprovalLinks: true,
    priorityRendering: true,
    tagline: "Run every client workspace from one place.",
    highlights: [
      "Multiple client workspaces",
      "Team members & workspace switching",
      "Client approval links",
      "Usage reporting per client",
      "White-label-ready architecture",
      "Priority rendering",
    ],
  },
];

export function getPlanDefinition(key: PlanDefinition["key"]): PlanDefinition {
  const plan = PLAN_CATALOG.find((p) => p.key === key);
  if (!plan) throw new Error(`Unknown plan key: ${key}`);
  return plan;
}
