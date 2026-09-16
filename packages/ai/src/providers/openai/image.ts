import OpenAI from "openai";

import { classifyProviderError } from "../errors";
import {
  ProviderError,
  type BinaryGenerationRequest,
  type ImageGenerationProvider,
  type ProviderResult,
  type GeneratedMedia,
} from "../types";

export class OpenAIImageGenerationProvider implements ImageGenerationProvider {
  readonly name = "openai";
  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY,
    private readonly model = process.env.OPENAI_IMAGE_MODEL,
    private readonly client?: OpenAI,
  ) {}
  validateConfiguration() {
    if (!this.apiKey || !this.model)
      throw new ProviderError(
        "OpenAI image setup required: API key and image model",
        "INVALID_REQUEST",
        false,
        this.name,
      );
  }
  async healthCheck() {
    return {
      status: this.apiKey && this.model ? ("healthy" as const) : ("unavailable" as const),
      checkedAt: new Date(),
      message: "Configuration check; API access is checked on generation",
    };
  }
  async generateImage(request: BinaryGenerationRequest): Promise<ProviderResult<GeneratedMedia>> {
    this.validateConfiguration();
    if (!request.prompt || request.prompt.length > 16_000)
      throw new ProviderError("Invalid image prompt length", "INVALID_REQUEST", false, this.name);
    const started = Date.now();
    try {
      const client = this.client ?? new OpenAI({ apiKey: this.apiKey, maxRetries: 0 });
      const result = await client.images.generate(
        {
          model: this.model!,
          prompt: request.prompt,
          n: 1,
          size: "1024x1024",
          output_format: "png",
        },
        {
          signal: request.signal,
          timeout: request.timeoutMs ?? 120_000,
          headers: { "Idempotency-Key": request.idempotencyKey },
        },
      );
      const encoded = result.data?.[0]?.b64_json;
      if (!encoded)
        throw new ProviderError(
          "Image provider returned no binary image",
          "INVALID_REQUEST",
          false,
          this.name,
        );
      const bytes = Buffer.from(encoded, "base64");
      if (bytes.length < 24 || bytes.toString("hex", 0, 8) !== "89504e470d0a1a0a")
        throw new ProviderError("Invalid PNG response", "INVALID_REQUEST", false, this.name);
      const estimate = Number(process.env.OPENAI_IMAGE_COST_CENTS);
      const costKnown = Number.isFinite(estimate) && estimate >= 0;
      return {
        data: {
          bytes,
          mimeType: "image/png",
          width: bytes.readUInt32BE(16),
          height: bytes.readUInt32BE(20),
        },
        usage: {
          provider: this.name,
          model: this.model!,
          durationMs: Date.now() - started,
          costCents: costKnown ? Math.ceil(estimate) : 0,
          mediaCount: 1,
          costKnown,
          costEstimated: true,
        },
      };
    } catch (error) {
      throw classifyProviderError(error, this.name);
    }
  }
}
