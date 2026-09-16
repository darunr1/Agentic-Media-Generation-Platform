import { classifyProviderError } from "./errors";
import { GeminiTextGenerationProvider } from "./gemini/text";
import { MockTextGenerationProvider } from "./mock/text";
import { OpenAITextGenerationProvider } from "./openai/text";
import {
  ProviderError,
  type TextGenerationProvider,
  type TextGenerationRequest,
  type ProviderHealth,
  type ProviderResult,
} from "./types";

export class ProviderRouter implements TextGenerationProvider {
  readonly name = "router";
  private readonly failures = new Map<string, { count: number; openUntil: number }>();
  constructor(
    private readonly providers: Readonly<Record<string, TextGenerationProvider>>,
    private readonly defaultProvider: string,
    private readonly fallback?: string,
    private readonly timeoutMs = 45_000,
  ) {
    if (defaultProvider !== "mock" && fallback === "mock")
      throw new ProviderError(
        "Real providers cannot fall back to mock",
        "INVALID_REQUEST",
        false,
        "router",
      );
  }
  validateConfiguration() {
    const provider = this.providers[this.defaultProvider];
    if (!provider) throw new ProviderError("Unknown provider", "INVALID_REQUEST", false, this.name);
    provider.validateConfiguration();
  }
  async healthCheck(): Promise<ProviderHealth> {
    return (
      this.providers[this.defaultProvider]?.healthCheck() ?? {
        status: "unavailable",
        checkedAt: new Date(),
      }
    );
  }
  async generate(request: TextGenerationRequest): Promise<ProviderResult<unknown>> {
    return this.route(request);
  }
  async repair(request: TextGenerationRequest, output: unknown, issues: string[]) {
    return this.route(request, { output, issues });
  }
  private async route(
    request: TextGenerationRequest,
    repair?: { output: unknown; issues: string[] },
  ): Promise<ProviderResult<unknown>> {
    const selected = request.provider ?? this.defaultProvider;
    const names = [...new Set([selected, ...(this.fallback ? [this.fallback] : [])])];
    let failure = new ProviderError("No healthy provider available", "UNAVAILABLE", true, selected);
    for (const name of names) {
      if (selected !== "mock" && name === "mock") continue;
      const provider = this.providers[name];
      if (!provider)
        throw new ProviderError(
          "Requested provider is not configured",
          "INVALID_REQUEST",
          false,
          name,
        );
      if ((this.failures.get(name)?.openUntil ?? 0) > Date.now()) continue;
      const controller = new AbortController();
      const signal = request.signal
        ? AbortSignal.any([request.signal, controller.signal])
        : controller.signal;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new ProviderError("Provider timed out", "TIMEOUT", true, name));
          }, request.timeoutMs ?? this.timeoutMs);
        });
        const routedRequest = {
          ...request,
          signal,
          ...(name !== selected ? { model: undefined } : {}),
        };
        const result = await Promise.race([
          repair
            ? provider.repair(routedRequest, repair.output, repair.issues)
            : provider.generate(routedRequest),
          deadline,
        ]);
        this.failures.delete(name);
        return result;
      } catch (error) {
        failure = classifyProviderError(error, name);
        if (request.signal?.aborted || !failure.retryable) throw failure;
        const count = (this.failures.get(name)?.count ?? 0) + 1;
        this.failures.set(name, { count, openUntil: count >= 3 ? Date.now() + 30_000 : 0 });
      } finally {
        clearTimeout(timer);
      }
    }
    throw failure;
  }
}
let cached: { configuration: string; provider: ProviderRouter } | undefined;
export function createTextProvider(source: NodeJS.ProcessEnv = process.env) {
  const configuration = JSON.stringify([
    source.AI_TEXT_PROVIDER,
    source.AI_FALLBACK_PROVIDER,
    source.AI_TIMEOUT_MS,
    source.OPENAI_API_KEY,
    source.OPENAI_TEXT_MODEL,
    source.GEMINI_API_KEY,
    source.GEMINI_TEXT_MODEL,
  ]);
  if (source === process.env && cached?.configuration === configuration) return cached.provider;
  const provider = new ProviderRouter(
    {
      mock: new MockTextGenerationProvider(),
      openai: new OpenAITextGenerationProvider(source.OPENAI_API_KEY, source.OPENAI_TEXT_MODEL),
      gemini: new GeminiTextGenerationProvider(source.GEMINI_API_KEY, source.GEMINI_TEXT_MODEL),
    },
    source.AI_TEXT_PROVIDER ?? "mock",
    source.AI_FALLBACK_PROVIDER || undefined,
    Number(source.AI_TIMEOUT_MS ?? 45_000),
  );
  provider.validateConfiguration();
  if (source === process.env) cached = { configuration, provider };
  return provider;
}
