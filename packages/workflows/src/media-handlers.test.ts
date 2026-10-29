import { MockTextToSpeechProvider } from "@contentforge/ai";
import { OPENAI_TTS_NOT_WIRED_MESSAGE } from "@contentforge/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PermanentTaskError } from "./executor";
import { mediaHandlers } from "./media-handlers";
import type { QueueTask } from "./queue";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("generation.voice provider rollout guard", () => {
  it("rejects OpenAI TTS clearly without generating mock audio", async () => {
    vi.stubEnv("AI_TTS_PROVIDER", "openai");
    const mockSpeech = vi.spyOn(MockTextToSpeechProvider.prototype, "synthesize");
    const handler = mediaHandlers["generation.voice"];
    if (!handler) throw new Error("generation.voice handler missing");

    const task: QueueTask = {
      id: "voice-guard-test",
      workspaceId: "test-workspace",
      type: "generation.voice",
      payload: {},
      idempotencyKey: "voice-guard-test",
      scheduledAt: new Date(0),
      attempt: 1,
      maxAttempts: 3,
    };

    const execution = handler.execute(task, new AbortController().signal);
    await expect(execution).rejects.toBeInstanceOf(PermanentTaskError);
    await expect(execution).rejects.toThrow(OPENAI_TTS_NOT_WIRED_MESSAGE);
    expect(mockSpeech).not.toHaveBeenCalled();
  });
});
