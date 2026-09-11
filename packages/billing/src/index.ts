export type SubscriptionState =
  "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" | "UNPAID";
export interface UsageSnapshot {
  contentItems: number;
  socialConnections: number;
  brands: number;
  teamMembers: number;
  spendCents: number;
}
export interface EffectiveLimits {
  contentItems: number;
  socialConnections: number;
  brands: number;
  teamMembers: number;
  monthlyBudgetCents: number;
  warningThreshold: number;
}
export interface EnforcementResult {
  allowed: boolean;
  code?:
    | "SUBSCRIPTION_INACTIVE"
    | "CONTENT_LIMIT"
    | "CONNECTION_LIMIT"
    | "BRAND_LIMIT"
    | "TEAM_LIMIT"
    | "BUDGET_LIMIT";
  message?: string;
  warning?: string;
}

export function enforceSubscription(
  state: SubscriptionState,
  trialEndsAt?: Date | null,
  now = new Date(),
): EnforcementResult {
  if (state === "TRIALING" && trialEndsAt && trialEndsAt <= now)
    return {
      allowed: false,
      code: "SUBSCRIPTION_INACTIVE",
      message: "The free trial has ended. Choose a plan to continue.",
    };
  if (state !== "TRIALING" && state !== "ACTIVE")
    return {
      allowed: false,
      code: "SUBSCRIPTION_INACTIVE",
      message: "The subscription is not active.",
    };
  return { allowed: true };
}

export function enforceUsage(
  kind: "content" | "connection" | "brand" | "team" | "spend",
  usage: UsageSnapshot,
  limits: EffectiveLimits,
  estimatedCostCents = 0,
): EnforcementResult {
  const pairs = {
    content: [usage.contentItems, limits.contentItems, "CONTENT_LIMIT"],
    connection: [usage.socialConnections, limits.socialConnections, "CONNECTION_LIMIT"],
    brand: [usage.brands, limits.brands, "BRAND_LIMIT"],
    team: [usage.teamMembers, limits.teamMembers, "TEAM_LIMIT"],
    spend: [usage.spendCents + estimatedCostCents, limits.monthlyBudgetCents, "BUDGET_LIMIT"],
  } as const;
  const [current, limit, code] = pairs[kind];
  if (limit >= 0 && current >= limit)
    return { allowed: false, code, message: `This workspace has reached its ${kind} limit.` };
  const warning =
    limit > 0 && current / limit >= limits.warningThreshold
      ? `This workspace has used at least ${Math.round(limits.warningThreshold * 100)}% of its ${kind} allowance.`
      : undefined;
  return { allowed: true, warning };
}

export interface CheckoutAdapter {
  createCheckout(input: {
    customerId?: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    trialDays?: number;
    workspaceId: string;
  }): Promise<{ url: string }>;
  createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  verifyWebhook(
    payload: Uint8Array,
    signature: string,
  ): Promise<{ id: string; type: string; data: unknown; created: number }>;
}
export class SetupRequiredCheckoutAdapter implements CheckoutAdapter {
  private error(): never {
    throw new Error(
      "Stripe setup required: configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and plan price IDs.",
    );
  }
  async createCheckout(): Promise<{ url: string }> {
    return this.error();
  }
  async createPortal(): Promise<{ url: string }> {
    return this.error();
  }
  async verifyWebhook(): Promise<{ id: string; type: string; data: unknown; created: number }> {
    return this.error();
  }
}

export function verifyWebhookTimestamp(
  createdSeconds: number,
  nowMs = Date.now(),
  toleranceSeconds = 300,
): boolean {
  return Math.abs(Math.floor(nowMs / 1000) - createdSeconds) <= toleranceSeconds;
}
