import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __resetEnvCacheForTests, loadEnv } from "./env";

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

  it("accepts complete OpenAI speech configuration", () => {
    expect(loadEnv(realTts).AI_TTS_PROVIDER).toBe("openai");
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

describe("hosted authentication configuration", () => {
  const staging = {
    ...baseConfig,
    NODE_ENV: "production",
    APP_DEPLOYMENT: "staging",
    APP_URL: "https://staging.sequence.test",
    AUTH_URL: "https://staging.sequence.test",
    AUTH_SECRET: "unit-test-only-abcdefghijklmnopqrstuvwxyz-1234567890",
    ENCRYPTION_KEY: Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString("base64"),
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "unit-test-key",
    EMAIL_FROM: "Sequence <login@sequence.test>",
  };

  it("accepts valid hosted configuration without contacting the provider", () => {
    expect(loadEnv(staging).EMAIL_PROVIDER).toBe("resend");
  });

  it.each([
    ["NODE_ENV", "development"],
    ["APP_URL", "http://staging.sequence.test"],
    ["APP_URL", "https://localhost"],
    ["AUTH_URL", "https://wrong.sequence.test"],
    ["EMAIL_PROVIDER", "console"],
    ["RESEND_API_KEY", ""],
    ["EMAIL_FROM", "notifications@contentforge.local"],
    ["AUTH_SECRET", "a".repeat(32)],
    ["ENCRYPTION_KEY", Buffer.alloc(32).toString("base64")],
  ])("rejects insecure %s", (key, value) => {
    expect(() => loadEnv({ ...staging, [key]: value })).toThrow(key);
  });

  it("preserves local production-mode builds and demo Compose", () => {
    expect(loadEnv({ ...baseConfig, NODE_ENV: "production" }).EMAIL_PROVIDER).toBe("console");
  });

  it("parses explicit false for host trust", () => {
    expect(loadEnv({ ...baseConfig, AUTH_TRUST_HOST: "false" }).AUTH_TRUST_HOST).toBe(false);
  });
});
