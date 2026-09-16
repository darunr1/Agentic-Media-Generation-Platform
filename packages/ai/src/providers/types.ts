export interface ProviderUsageReport {
  provider: string;
  model: string;
  durationMs: number;
  costCents: number;
  inputTokens?: number;
  outputTokens?: number;
  mediaCount?: number;
  costEstimated?: boolean;
  costKnown?: boolean;
}

export interface ProviderHealth {
  status: "healthy" | "degraded" | "unavailable";
  checkedAt: Date;
  message?: string;
}

export class ProviderError extends Error {
  usageReports?: ProviderUsageReport[];
  constructor(
    message: string,
    readonly code: "TIMEOUT" | "RATE_LIMITED" | "INVALID_REQUEST" | "UNAVAILABLE" | "UNKNOWN",
    readonly retryable: boolean,
    readonly provider: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface ProviderResult<T> {
  data: T;
  usage: ProviderUsageReport;
  rawResponseId?: string;
  usageReports?: ProviderUsageReport[];
}

export interface TextGenerationRequest {
  system: string;
  prompt: string;
  model?: string;
  temperature?: number;
  idempotencyKey: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  provider?: string;
  operation?: "strategy" | "ideas" | "script" | "critique" | "revision";
  responseSchema?: Record<string, unknown>;
}

export interface TextGenerationProvider {
  readonly name: string;
  validateConfiguration(): void;
  healthCheck(): Promise<ProviderHealth>;
  generate(request: TextGenerationRequest): Promise<ProviderResult<unknown>>;
  repair(
    request: TextGenerationRequest,
    invalidOutput: unknown,
    issues: string[],
  ): Promise<ProviderResult<unknown>>;
}

export interface EmbeddingProvider {
  readonly name: string;
  validateConfiguration(): void;
  healthCheck(): Promise<ProviderHealth>;
  embed(
    input: string[],
    options: { idempotencyKey: string; timeoutMs?: number },
  ): Promise<ProviderResult<number[][]>>;
}

export interface BinaryGenerationRequest {
  prompt: string;
  idempotencyKey: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface GeneratedMedia {
  bytes: Uint8Array;
  mimeType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface ImageGenerationProvider {
  readonly name: string;
  validateConfiguration(): void;
  healthCheck(): Promise<ProviderHealth>;
  generateImage(request: BinaryGenerationRequest): Promise<ProviderResult<GeneratedMedia>>;
}

export interface VideoGenerationProvider {
  readonly name: string;
  validateConfiguration(): void;
  healthCheck(): Promise<ProviderHealth>;
  generateVideo(request: BinaryGenerationRequest): Promise<ProviderResult<GeneratedMedia>>;
}

export interface TextToSpeechProvider {
  readonly name: string;
  validateConfiguration(): void;
  healthCheck(): Promise<ProviderHealth>;
  synthesize(input: {
    text: string;
    voice: string;
    idempotencyKey: string;
    timeoutMs?: number;
  }): Promise<ProviderResult<GeneratedMedia>>;
}

export interface TranscriptionProvider {
  readonly name: string;
  validateConfiguration(): void;
  healthCheck(): Promise<ProviderHealth>;
  transcribe(input: {
    audio: Uint8Array;
    mimeType: string;
    idempotencyKey: string;
    timeoutMs?: number;
  }): Promise<
    ProviderResult<{ text: string; words: Array<{ text: string; startMs: number; endMs: number }> }>
  >;
}
