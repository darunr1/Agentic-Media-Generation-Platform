import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetEnvCacheForTests, loadEnv, OPENAI_TTS_NOT_WIRED_MESSAGE } from "./env";

const baseConfig = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  AUTH_SECRET: "a".repeat(32),
  ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
};

const realTts = {
  ...baseConfig,
  AI_TTS_PROVIDER: "openai",
  OPENAI_API_KEY: "unit-test-key",
  OPENAI_TTS_MODEL: "gpt-4o-mini-tts",
  OPENAI_TTS_VOICE: "alloy",
};

beforeEach(__resetEnvCacheForTests);
afterEach(__resetEnvCacheForTests);

describe("TTS startup configuration", () => {
  it("defaults to mock without OpenAI credentials", () => {
    expect(loadEnv(baseConfig).AI_TTS_PROVIDER).toBe("mock");
  });

  it("allows explicit mock even when real-provider configuration is absent", () => {
    expect(loadEnv({ ...baseConfig, AI_TTS_PROVIDER: "mock" }).AI_TTS_PROVIDER).toBe("mock");
  });

  it("fails at startup even with complete OpenAI credentials until D04", () => {
    expect(() => loadEnv(realTts)).toThrow(OPENAI_TTS_NOT_WIRED_MESSAGE);
  });

  it.each(["OPENAI_API_KEY", "OPENAI_TTS_MODEL", "OPENAI_TTS_VOICE"] as const)(
    "rejects an absent %s for OpenAI TTS",
    (key) => {
      expect(() => loadEnv({ ...realTts, [key]: " " })).toThrow(key);
    },
  );

  it("rejects unsupported TTS provider values", () => {
    expect(() => loadEnv({ ...baseConfig, AI_TTS_PROVIDER: "elevenlabs" })).toThrow(
      "AI_TTS_PROVIDER",
    );
  });
});
