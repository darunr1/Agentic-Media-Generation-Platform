import { describe, expect, it } from "vitest";

import { startGeneration } from "./enqueue";
describe("generation target isolation", () => {
  const base = { workspaceId: "tenant", userId: "owner", idempotencyKey: "test" };
  it("cannot attach another content item to campaign planning", async () => {
    await expect(
      startGeneration({
        ...base,
        operation: "strategy",
        campaignId: "campaign",
        contentItemId: "other-tenant-content",
      }),
    ).rejects.toThrow("Provide only");
  });
  it("rejects mixed script/campaign targets", async () => {
    await expect(
      startGeneration({
        ...base,
        operation: "script",
        contentItemId: "content",
        campaignId: "other-campaign",
      }),
    ).rejects.toThrow("Provide only");
  });
  it("cannot interpret a missing content ID as a broad database lookup", async () => {
    await expect(startGeneration({ ...base, operation: "script" })).rejects.toThrow("Provide only");
  });
});
