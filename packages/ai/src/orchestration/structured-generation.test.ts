import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { MockTextGenerationProvider } from "../providers/mock/text";
import { ProviderError } from "../providers/types";

import { generateStructured } from "./structured-generation";
const usage = {
  provider: "mock",
  model: "test",
  durationMs: 10,
  costCents: 2,
  inputTokens: 3,
  outputTokens: 4,
};
describe("repair usage accounting", () => {
  it("accumulates every attempt and uses distinct repair keys", async () => {
    const provider = new MockTextGenerationProvider();
    vi.spyOn(provider, "generate").mockResolvedValue({ data: {}, usage });
    const repair = vi
      .spyOn(provider, "repair")
      .mockResolvedValueOnce({ data: {}, usage })
      .mockResolvedValueOnce({ data: { ok: true }, usage });
    const result = await generateStructured({
      provider,
      request: { system: "test", prompt: "test", idempotencyKey: "original" },
      schema: z.object({ ok: z.boolean() }),
    });
    expect(result.usage.costCents).toBe(6);
    expect(result.usageReports).toHaveLength(3);
    expect(repair.mock.calls.map((c) => c[0].idempotencyKey)).toEqual([
      "original:repair:1",
      "original:repair:2",
    ]);
  });
  it("retains known charges when validation exhausts its repair budget", async () => {
    const provider = new MockTextGenerationProvider();
    vi.spyOn(provider, "generate").mockResolvedValue({ data: {}, usage });
    vi.spyOn(provider, "repair").mockResolvedValue({ data: {}, usage });
    const error = await generateStructured({
      provider,
      request: { system: "test", prompt: "test", idempotencyKey: "test" },
      schema: z.object({ ok: z.boolean() }),
      maxRepairAttempts: 50,
    }).catch((e) => e as ProviderError);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).usageReports).toHaveLength(3);
  });
});
