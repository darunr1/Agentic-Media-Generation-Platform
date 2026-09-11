import { describe, expect, it } from "vitest";

import { MockTextGenerationProvider, generateStructured, ideasSchema, scriptSchema } from "./index";
describe("mock generation", () => {
  const provider = new MockTextGenerationProvider();
  it("returns exactly five validated ideas", async () => {
    const result = await generateStructured({
      provider,
      schema: ideasSchema,
      request: { system: "test", prompt: "Generate five ideas", idempotencyKey: "ideas-test" },
    });
    expect(result.data).toHaveLength(5);
    expect(result.usage.costCents).toBe(0);
  });
  it("returns a timed scene script", async () => {
    const result = await generateStructured({
      provider,
      schema: scriptSchema,
      request: { system: "test", prompt: "Generate a script", idempotencyKey: "script-test" },
    });
    expect(result.data.scenes.at(-1)?.endSeconds).toBe(24);
  });
});
