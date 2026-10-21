import OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAITextToSpeechProvider } from "../../index";
import { MockTextToSpeechProvider } from "../mock/media";
import type { TextToSpeechProvider } from "../types";

const input = { text: "Welcome to ContentForge.", voice: "alloy", idempotencyKey: "speech-test" };

async function setup() {
  const fixture = await new MockTextToSpeechProvider().synthesize({ ...input, durationSeconds: 1 });
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(
    async () =>
      new Response(Buffer.from(fixture.data.bytes), {
        headers: { "content-type": "audio/wav", "x-request-id": "req_speech_test" },
      }),
  );
  const client = new OpenAI({ apiKey: "unit-test-key", maxRetries: 0, fetch });
  const create = vi.spyOn(client.audio.speech, "create");
  const provider: TextToSpeechProvider = new OpenAITextToSpeechProvider("test", "tts-1", client);
  return { fixture, fetch, client, create, provider };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("OpenAI speech adapter", () => {
  it("returns playable WAV bytes and provider metadata through the real SDK with mocked HTTP", async () => {
    const { fixture, fetch, create, provider } = await setup();
    provider.validateConfiguration();
    expect(await provider.healthCheck()).toMatchObject({
      status: "healthy",
      checkedAt: expect.any(Date),
    });
    expect(fetch).not.toHaveBeenCalled();

    const result = await provider.synthesize(input);

    expect(create).toHaveBeenCalledWith(
      { model: "tts-1", input: input.text, voice: "alloy", response_format: "wav" },
      { timeout: 120_000, headers: { "Idempotency-Key": "speech-test" } },
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0]!;
    expect(String(url)).toBe("https://api.openai.com/v1/audio/speech");
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).get("Idempotency-Key")).toBe(input.idempotencyKey);
    expect(JSON.parse(String(options?.body))).toEqual({
      model: "tts-1",
      input: input.text,
      voice: "alloy",
      response_format: "wav",
    });
    expect(result.data.bytes).toBeInstanceOf(Uint8Array);
    expect(result.data.bytes).toEqual(fixture.data.bytes);
    expect(result.data.mimeType).toBe("audio/wav");
    const wav = Buffer.from(result.data.bytes);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt32LE(40)).toBe(wav.length - 44);
    expect(result.rawResponseId).toBe("req_speech_test");
    expect(result.usage).toEqual({
      provider: "openai",
      model: "tts-1",
      durationMs: expect.any(Number),
      costCents: 0,
      costKnown: false,
      mediaCount: 1,
    });
    expect(result.usage.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.data.durationSeconds).toBeUndefined();
  });

  it("forwards a caller-supplied timeout and accepts the maximum input length", async () => {
    const { provider, create } = await setup();
    await provider.synthesize({ ...input, text: "x".repeat(4096), timeoutMs: 5000 });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ input: "x".repeat(4096) }),
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it.each([
    { text: "" },
    { text: "   " },
    { text: "x".repeat(4097) },
    { voice: " " },
    { idempotencyKey: " " },
    { timeoutMs: 0 },
    { timeoutMs: -1 },
    { timeoutMs: NaN },
    { timeoutMs: Infinity },
  ])("rejects invalid input before calling the SDK (case %#)", async (invalid) => {
    const { provider, create } = await setup();
    await expect(provider.synthesize({ ...input, ...invalid })).rejects.toMatchObject({
      code: "INVALID_REQUEST",
      retryable: false,
      provider: "openai",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ["", "tts-1"],
    ["test", ""],
    [" ", "tts-1"],
    ["test", " "],
  ])("rejects missing configuration without a network call (%j, %j)", async (key, model) => {
    const { client, fetch } = await setup();
    const provider = new OpenAITextToSpeechProvider(key, model, client);
    expect(() => provider.validateConfiguration()).toThrow("OpenAI speech setup required");
    expect((await provider.healthCheck()).status).toBe("unavailable");
    await expect(provider.synthesize(input)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reads configuration from the environment without activating a request", async () => {
    vi.stubEnv("OPENAI_API_KEY", "unit-test-key");
    vi.stubEnv("OPENAI_TTS_MODEL", "tts-1");
    const provider = new OpenAITextToSpeechProvider();
    expect(() => provider.validateConfiguration()).not.toThrow();
    expect((await provider.healthCheck()).status).toBe("healthy");
  });

  it.each([Buffer.alloc(0), Buffer.from("not audio"), Buffer.alloc(48)])(
    "rejects empty or non-WAV responses",
    async (body) => {
      const { provider, fetch } = await setup();
      fetch.mockResolvedValueOnce(new Response(body));
      await expect(provider.synthesize(input)).rejects.toMatchObject({
        code: "INVALID_REQUEST",
        retryable: false,
        provider: "openai",
        message: "Invalid WAV response",
      });
    },
  );

  it.each([
    [429, "RATE_LIMITED", true],
    [500, "UNAVAILABLE", true],
    [401, "INVALID_REQUEST", false],
  ])("classifies HTTP %i errors", async (status, code, retryable) => {
    const { provider, fetch } = await setup();
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "test failure" } }), {
        status: Number(status),
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(provider.synthesize(input)).rejects.toMatchObject({
      code,
      retryable,
      provider: "openai",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("classifies SDK timeouts as retryable", async () => {
    const { provider, create } = await setup();
    create.mockRejectedValueOnce(new OpenAI.APIConnectionTimeoutError());
    await expect(provider.synthesize(input)).rejects.toMatchObject({
      code: "TIMEOUT",
      retryable: true,
      provider: "openai",
    });
  });

  it("classifies SDK connection failures as retryable", async () => {
    const { provider, fetch } = await setup();
    fetch.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(provider.synthesize(input)).rejects.toMatchObject({
      code: "UNAVAILABLE",
      retryable: true,
      provider: "openai",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
