import OpenAI from "openai";

import { estimateTextCost } from "../../usage/pricing";
import { classifyProviderError, parseJson, repairRequest, validateTextRequest } from "../errors";
import type {
  TextGenerationProvider,
  TextGenerationRequest,
  ProviderResult,
  ProviderHealth,
} from "../types";
import { ProviderError } from "../types";

export class OpenAITextGenerationProvider implements TextGenerationProvider {
  readonly name = "openai";
  constructor(
    private readonly apiKey = process.env.OPENAI_API_KEY,
    private readonly model = process.env.OPENAI_TEXT_MODEL,
    private readonly client?: OpenAI,
  ) {}
  validateConfiguration() {
    if (!this.apiKey || !this.model)
      throw new ProviderError(
        "OpenAI setup required: API key and text model",
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
      const client = this.client ?? new OpenAI({ apiKey: this.apiKey, maxRetries: 0 });
      const response = await client.responses.create(
        {
          model: request.model ?? this.model!,
          instructions: request.system,
          input: `${request.prompt}\nReturn a JSON object with a result field matching the requested schema.`,
          text: {
            format: {
              type: "json_schema",
              name: "agent_output",
              strict: false,
              schema: {
                type: "object",
                properties: { result: request.responseSchema ?? {} },
                required: ["result"],
                additionalProperties: false,
              },
            },
          },
          store: false,
        },
        {
          signal: request.signal,
          timeout: request.timeoutMs ?? 45_000,
          headers: { "Idempotency-Key": request.idempotencyKey },
        },
      );
      const inputTokens = response.usage?.input_tokens ?? 0,
        outputTokens = response.usage?.output_tokens ?? 0;
      return {
        data: unwrapResult(parseJson(response.output_text)),
        rawResponseId: response.id,
        usage: {
          provider: this.name,
          model: response.model,
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

function unwrapResult(value: unknown): unknown {
  return typeof value === "object" && value !== null && "result" in value ? value.result : value;
}
