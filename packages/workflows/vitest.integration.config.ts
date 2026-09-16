import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    globalSetup: ["../database/src/test/global-setup.ts"],
    testTimeout: 180000,
    hookTimeout: 120000,
    fileParallelism: false,
    env: { AI_TEXT_PROVIDER: "mock", AI_IMAGE_PROVIDER: "mock", AI_TTS_PROVIDER: "mock" },
  },
});
