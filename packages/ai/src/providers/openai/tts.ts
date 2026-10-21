import OpenAI from "openai";

import { classifyProviderError } from "../errors";
import {
  ProviderError,
  type GeneratedMedia,
  type ProviderResult,
  type TextToSpeechProvider,
} from "../types";

/** Standalone adapter; configure OPENAI_API_KEY and OPENAI_TTS_MODEL before use. */
export class OpenAITextToSpeechProvider implements TextToSpeechProvider {
  readonly name = "openai";
  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY,
    private readonly model = process.env.OPENAI_TTS_MODEL,
    private readonly client?: OpenAI,
  ) {}
  validateConfiguration() {
    if (!this.apiKey?.trim() || !this.model?.trim())
      throw new ProviderError(
        "OpenAI speech setup required: API key and TTS model",
        "INVALID_REQUEST",
        false,
        this.name,
      );
  }
  async healthCheck() {
    return {
      status:
        this.apiKey?.trim() && this.model?.trim() ? ("healthy" as const) : ("unavailable" as const),
      checkedAt: new Date(),
      message: "Configuration check; API access is checked on synthesis",
    };
  }
  async synthesize(
    input: Parameters<TextToSpeechProvider["synthesize"]>[0],
  ): Promise<ProviderResult<GeneratedMedia>> {
    this.validateConfiguration();
    if (
      !input.text.trim() ||
      input.text.length > 4096 ||
      !input.voice.trim() ||
      !input.idempotencyKey.trim() ||
      (input.timeoutMs !== undefined &&
        (!Number.isFinite(input.timeoutMs) ||
          input.timeoutMs <= 0 ||
          input.timeoutMs > 2_147_483_647))
    )
      throw new ProviderError("Invalid speech request", "INVALID_REQUEST", false, this.name);
    const started = Date.now();
    const timeoutMs = input.timeoutMs ?? 120_000;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const client = this.client ?? new OpenAI({ apiKey: this.apiKey, maxRetries: 0 });
      // The SDK's binary-response timeout stops at the headers. Keep one deadline
      // through body consumption and abort the transport if the download stalls.
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new ProviderError("OpenAI speech request timed out", "TIMEOUT", true, this.name));
        }, timeoutMs);
      });
      const { response, bytes } = await Promise.race([
        (async () => {
          const response = await client.audio.speech.create(
            {
              model: this.model!,
              input: input.text,
              voice: input.voice,
              response_format: "wav",
            },
            {
              timeout: timeoutMs,
              signal: controller.signal,
              headers: { "Idempotency-Key": input.idempotencyKey },
            },
          );
          const bytes = Buffer.from(await response.arrayBuffer());
          return { response, bytes };
        })(),
        deadline,
      ]);
      if (
        bytes.length <= 44 ||
        bytes.toString("ascii", 0, 4) !== "RIFF" ||
        bytes.toString("ascii", 8, 12) !== "WAVE"
      )
        throw new ProviderError("Invalid WAV response", "INVALID_REQUEST", false, this.name);
      return {
        data: { bytes, mimeType: "audio/wav" },
        rawResponseId: response.headers.get("x-request-id") ?? undefined,
        usage: {
          provider: this.name,
          model: this.model!,
          durationMs: Date.now() - started,
          mediaCount: 1,
          // Speech responses do not include usage; zero here does not mean a free call.
          costCents: 0,
          costKnown: false,
        },
      };
    } catch (error) {
      // SDK connection errors have no HTTP status and retain the generic Error name.
      if (
        controller.signal.aborted ||
        error instanceof OpenAI.APIConnectionTimeoutError ||
        (error instanceof OpenAI.APIError && error.status === 408)
      )
        throw new ProviderError("OpenAI speech request timed out", "TIMEOUT", true, this.name);
      if (error instanceof OpenAI.APIConnectionError)
        throw new ProviderError("OpenAI speech connection failed", "UNAVAILABLE", true, this.name);
      throw classifyProviderError(error, this.name);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
