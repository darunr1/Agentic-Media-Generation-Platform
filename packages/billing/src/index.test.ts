import { describe, expect, it } from "vitest";

import { enforceSubscription, enforceUsage, verifyWebhookTimestamp } from "./index";
const limits = {
  contentItems: 12,
  socialConnections: 1,
  brands: 1,
  teamMembers: 2,
  monthlyBudgetCents: 2000,
  warningThreshold: 0.8,
};
describe("billing enforcement", () => {
  it("blocks expired trials", () =>
    expect(enforceSubscription("TRIALING", new Date(0)).allowed).toBe(false));
  it("blocks the hard budget", () =>
    expect(
      enforceUsage(
        "spend",
        { contentItems: 0, socialConnections: 0, brands: 0, teamMembers: 0, spendCents: 1995 },
        limits,
        5,
      ).code,
    ).toBe("BUDGET_LIMIT"));
  it("rejects stale webhooks", () => expect(verifyWebhookTimestamp(1, Date.now())).toBe(false));
});
