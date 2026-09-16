import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

import { GeminiTextGenerationProvider } from "./gemini/text";
import { MockImageGenerationProvider, MockTextToSpeechProvider } from "./mock/media";
import { MockTextGenerationProvider } from "./mock/text";
import { OpenAIImageGenerationProvider } from "./openai/image";
import { OpenAITextGenerationProvider } from "./openai/text";
import { ProviderRouter } from "./router";
import { ProviderError, type TextGenerationProvider } from "./types";

const request = { system: "Return JSON", prompt: "Generate strategy", idempotencyKey: "test-key" };
function textContract(name: string, create: () => TextGenerationProvider) {
  describe(`${name} text contract`, () => {
    it("returns data, provider identity and nonnegative usage", async () => {
      const provider = create();
      provider.validateConfiguration();
      const result = await provider.generate(request);
      expect(result.data).toBeDefined();
      expect(result.usage.provider).toBe(provider.name);
      expect(result.usage.model).toBeTruthy();
      expect(result.usage.costCents).toBeGreaterThanOrEqual(0);
      expect(result.usage.durationMs).toBeGreaterThanOrEqual(0);
      expect((await provider.healthCheck()).status).toBe("healthy");
    });
    it("supports schema repair through the same contract", async () => {
      const result = await create().repair(
        { ...request, idempotencyKey: "repair-key" },
        { invalid: true },
        ["Missing property"],
      );
      expect(result.data).toBeDefined();
    });
  });
}
const openaiClient = () =>
  new OpenAI({
    apiKey: "unit-test-key",
    maxRetries: 0,
    fetch: async () =>
      new Response(
        JSON.stringify({
          id: "resp_test",
          object: "response",
          status: "completed",
          model: "test-model",
          output: [
            {
              type: "message",
              role: "assistant",
              content: [
                { type: "output_text", text: '{"result":{"valid":true}}', annotations: [] },
              ],
            },
          ],
          usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
        }),
        { headers: { "content-type": "application/json" } },
      ),
  });
function geminiClient() {
  const client = new GoogleGenAI({ apiKey: "unit-test-key" });
  vi.spyOn(client.interactions, "create").mockResolvedValue({
    id: "interaction_test",
    output_text: '{"valid":true}',
    usage: { total_input_tokens: 10, total_output_tokens: 20 },
  } as Awaited<ReturnType<typeof client.interactions.create>>);
  return client;
}
textContract("mock", () => new MockTextGenerationProvider());
textContract(
  "openai",
  () => new OpenAITextGenerationProvider("test", "test-model", openaiClient()),
);
textContract(
  "gemini",
  () => new GeminiTextGenerationProvider("test", "test-model", geminiClient()),
);
describe("provider routing", () => {
  it("fails over only for retryable errors and opens the circuit", async () => {
    const primary = new MockTextGenerationProvider(),
      fallback = new MockTextGenerationProvider();
    const fail = vi
      .spyOn(primary, "generate")
      .mockRejectedValue(new ProviderError("temporary", "UNAVAILABLE", true, "openai"));
    const router = new ProviderRouter({ openai: primary, gemini: fallback }, "openai", "gemini");
    for (let i = 0; i < 4; i++) await router.generate(request);
    expect(fail).toHaveBeenCalledTimes(3);
  });
  it("does not hide permanent errors behind fallback", async () => {
    const primary = new MockTextGenerationProvider(),
      fallback = new MockTextGenerationProvider();
    vi.spyOn(primary, "generate").mockRejectedValue(
      new ProviderError("bad credentials", "INVALID_REQUEST", false, "openai"),
    );
    const spy = vi.spyOn(fallback, "generate");
    await expect(
      new ProviderRouter({ openai: primary, gemini: fallback }, "openai", "gemini").generate(
        request,
      ),
    ).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
  it("never configures mock as a real-provider fallback", () =>
    expect(() => new ProviderRouter({}, "openai", "mock")).toThrow());
  it("enforces a deadline for an unresponsive provider", async () => {
    const provider = new MockTextGenerationProvider();
    provider.generate = () => new Promise(() => {});
    await expect(
      new ProviderRouter({ mock: provider }, "mock", undefined, 10).generate(request),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
describe("binary provider contracts", () => {
  it("produces deterministic valid PNG bytes with dimensions", async () => {
    const provider = new MockImageGenerationProvider(),
      input = { prompt: "coffee", idempotencyKey: "test", width: 32, height: 32 };
    const a = await provider.generateImage(input),
      b = await provider.generateImage(input);
    expect(a.data.bytes).toEqual(b.data.bytes);
    expect(Buffer.from(a.data.bytes).toString("hex", 0, 8)).toBe("89504e470d0a1a0a");
    expect(a.data.width).toBe(32);
  });
  it("produces a playable WAV reference tone", async () => {
    const result = await new MockTextToSpeechProvider().synthesize({
      text: "hello",
      voice: "mock",
      idempotencyKey: "test",
    });
    expect(Buffer.from(result.data.bytes).toString("ascii", 0, 4)).toBe("RIFF");
    expect(result.data.durationSeconds).toBeGreaterThan(0);
  });
  it("uses the real image SDK boundary without a paid call", async () => {
    const png = await new MockImageGenerationProvider().generateImage({
      prompt: "x",
      idempotencyKey: "x",
      width: 32,
      height: 32,
    });
    const client = new OpenAI({
      apiKey: "test",
      fetch: async () =>
        new Response(
          JSON.stringify({
            created: 0,
            data: [{ b64_json: Buffer.from(png.data.bytes).toString("base64") }],
          }),
          { headers: { "content-type": "application/json" } },
        ),
    });
    const result = await new OpenAIImageGenerationProvider(
      "test",
      "image-model",
      client,
    ).generateImage({ prompt: "coffee", idempotencyKey: "image" });
    expect(result.data.mimeType).toBe("image/png");
    expect(result.usage.provider).toBe("openai");
  });
});
