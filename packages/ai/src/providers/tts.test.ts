import { afterEach, describe, expect, it, vi } from "vitest";

import { createTtsProvider } from "../../index";
import { MockTextToSpeechProvider } from "./mock/media";
import { OpenAITextToSpeechProvider } from "./openai/tts";
import { ProviderError } from "./types";

const speech = { text: "Test speech", voice: "", idempotencyKey: "d03-test" };
const realConfig = {
  AI_TTS_PROVIDER: "openai",
  OPENAI_API_KEY: "unit-test-key",
  OPENAI_TTS_MODEL: "gpt-4o-mini-tts",
  OPENAI_TTS_VOICE: "alloy",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TTS provider selection", () => {
  it("defaults to mock with no credentials and produces local audio", async () => {
    const provider = createTtsProvider({});
    expect(provider).toBeInstanceOf(MockTextToSpeechProvider);
    expect(provider.name).toBe("mock");

    const result = await provider.synthesize(speech);
    expect(result.usage.provider).toBe("mock");
    expect(result.data.mimeType).toBe("audio/wav");
    expect(Buffer.from(result.data.bytes).toString("ascii", 0, 4)).toBe("RIFF");
  });

  it("keeps explicit mock mode even with incomplete OpenAI settings", () => {
    const provider = createTtsProvider({
      AI_TTS_PROVIDER: "mock",
      OPENAI_API_KEY: "",
      OPENAI_TTS_MODEL: "",
      OPENAI_TTS_VOICE: "",
    });
    expect(provider.name).toBe("mock");
  });

  it.each(["", "elevenlabs", "gemini", "OPENAI"])(
    "rejects unsupported selection %j instead of using mock",
    (name) => {
      expect(() => createTtsProvider({ AI_TTS_PROVIDER: name })).toThrowError(
        expect.objectContaining({ code: "INVALID_REQUEST", provider: "tts" }),
      );
    },
  );

  it.each(["OPENAI_API_KEY", "OPENAI_TTS_MODEL", "OPENAI_TTS_VOICE"] as const)(
    "requires %s for real speech before making requests",
    (key) => {
      const network = vi.spyOn(globalThis, "fetch");
      expect(() => createTtsProvider({ ...realConfig, [key]: "   " })).toThrowError(
        expect.objectContaining({
          code: "INVALID_REQUEST",
          provider: "openai",
          message: expect.stringContaining(key),
        }),
      );
      expect(network).not.toHaveBeenCalled();
    },
  );

  it("reports every missing real-provider setting without exposing secrets", () => {
    expect(() => createTtsProvider({ AI_TTS_PROVIDER: "openai" })).toThrow(
      "OPENAI_API_KEY, OPENAI_TTS_MODEL, OPENAI_TTS_VOICE",
    );
  });

  it("selects the configured OpenAI adapter without performing an API call", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    const provider = createTtsProvider(realConfig);
    expect(provider.name).toBe("openai");
    expect(() => provider.validateConfiguration()).not.toThrow();
    expect((await provider.healthCheck()).status).toBe("healthy");
    expect(network).not.toHaveBeenCalled();
  });

  it("uses configured voice when the caller omits a meaningful voice", async () => {
    const request = vi
      .spyOn(OpenAITextToSpeechProvider.prototype, "synthesize")
      .mockRejectedValue(new ProviderError("upstream failure", "UNAVAILABLE", true, "openai"));
    const mock = vi.spyOn(MockTextToSpeechProvider.prototype, "synthesize");
    const provider = createTtsProvider(realConfig);

    await expect(provider.synthesize(speech)).rejects.toMatchObject({
      code: "UNAVAILABLE",
      provider: "openai",
    });
    expect(request).toHaveBeenCalledWith({ ...speech, voice: "alloy" });
    expect(mock).not.toHaveBeenCalled();
  });

  it("allows an explicit caller voice to override the configured default", async () => {
    const request = vi
      .spyOn(OpenAITextToSpeechProvider.prototype, "synthesize")
      .mockRejectedValue(new ProviderError("upstream failure", "UNAVAILABLE", true, "openai"));
    const provider = createTtsProvider(realConfig);

    await expect(provider.synthesize({ ...speech, voice: "nova" })).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
    expect(request).toHaveBeenCalledWith({ ...speech, voice: "nova" });
  });
});
