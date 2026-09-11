import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // Real coverage grows through Phase 11 (unit tests for pure service
    // logic + Playwright e2e for the full demo flow); most of apps/web's
    // logic is server components / route handlers exercised end-to-end
    // rather than in isolation.
    passWithNoTests: true,
  },
});
