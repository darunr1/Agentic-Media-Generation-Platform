import { GoogleGenAI } from "@google/genai";

import { estimateTextCost } from "../../usage/pricing";
import { classifyProviderError, parseJson, repairRequest, validateTextRequest } from "../errors";
import type {
  TextGenerationProvider,
  TextGenerationRequest,
  ProviderResult,
  ProviderHealth,
} from "../types";
import { ProviderError } from "../types";

export class GeminiTextGenerationProvider implements TextGenerationProvider {
  readonly name = "gemini";
  constructor(
    private readonly apiKey = process.env.GEMINI_API_KEY,
    private readonly model = process.env.GEMINI_TEXT_MODEL,
    private readonly client?: GoogleGenAI,
  ) {}
  validateConfiguration() {
    if (!this.apiKey || !this.model)
      throw new ProviderError(
        "Gemini setup required: API key and text model",
        "INVALID_REQUEST",
        false,
        this.name,
      );
  }
  async healthCheck(): Promise<ProviderHealth> {
    try {
      this.validateConfiguration();
      return {
        status: "healthy",
        checkedAt: new Date(),
        message: "Configuration valid; credentials verified on request",
      };
    } catch {
      return { status: "unavailable", checkedAt: new Date(), message: "Setup required" };
    }
  }
  async generate(request: TextGenerationRequest): Promise<ProviderResult<unknown>> {
    this.validateConfiguration();
    validateTextRequest(request, this.name);
    const started = Date.now();
    try {
      const client = this.client ?? new GoogleGenAI({ apiKey: this.apiKey });
      const response = await client.interactions.create(
        {
          model: request.model ?? this.model!,
          input: `${request.system}\n\n${request.prompt}`,
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: request.responseSchema ?? { type: "object" },
          },
          store: false,
        },
        { signal: request.signal, timeout: request.timeoutMs ?? 45_000, maxRetries: 0 },
      );
      const inputTokens = response.usage?.total_input_tokens ?? 0,
        outputTokens = response.usage?.total_output_tokens ?? 0;
      return {
        data: parseJson(response.output_text ?? ""),
        rawResponseId: response.id,
        usage: {
          provider: this.name,
          model: request.model ?? this.model!,
          inputTokens,
          outputTokens,
          durationMs: Date.now() - started,
          ...estimateTextCost(this.name, inputTokens, outputTokens),
        },
      };
    } catch (error) {
      throw classifyProviderError(error, this.name);
    }
  }
  repair(request: TextGenerationRequest, invalidOutput: unknown, issues: string[]) {
    return this.generate(repairRequest(request, invalidOutput, issues));
  }
}
