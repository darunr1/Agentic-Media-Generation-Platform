import { describe, expect, it } from "vitest";

import { MockSocialPlatformProvider, SetupRequiredSocialProvider } from "./index";
describe("social providers", () => {
  it("deduplicates mock publishes", async () => {
    const provider = new MockSocialPlatformProvider();
    const input = { idempotencyKey: "same-key", accountId: "demo", text: "Hello", media: [] };
    const [first, second] = await Promise.all([
      provider.createPost(input),
      provider.createPost(input),
    ]);
    expect(first.externalPostId).toBe(second.externalPostId);
  });
  it("marks production adapters as setup required", () =>
    expect(
      new SetupRequiredSocialProvider("INSTAGRAM").getPublishingCapabilities().setupRequired,
    ).toBe(true));
});
