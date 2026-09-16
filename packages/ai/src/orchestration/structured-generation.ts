import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  ProviderError,
  type TextGenerationProvider,
  type TextGenerationRequest,
  type ProviderResult,
} from "../providers/types";
export async function generateStructured<T>(options: {
  provider: TextGenerationProvider;
  request: TextGenerationRequest;
  schema: z.ZodType<T>;
  maxRepairAttempts?: number;
}): Promise<ProviderResult<T>> {
  const maxRepairs = Math.min(2, Math.max(0, options.maxRepairAttempts ?? 2));
  const request = {
    ...options.request,
    responseSchema: zodToJsonSchema(options.schema, { $refStrategy: "none" }) as Record<
      string,
      unknown
    >,
  };
  let result = await options.provider.generate(request);
  let usage = { ...result.usage };
  const usageReports = [...(result.usageReports ?? [result.usage])];
  for (let attempt = 0; attempt <= maxRepairs; attempt += 1) {
    const parsed = options.schema.safeParse(result.data);
    if (parsed.success) return { ...result, data: parsed.data, usage, usageReports };
    if (attempt === maxRepairs) {
      const error = new ProviderError(
        `Structured output validation failed: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
        "INVALID_REQUEST",
        false,
        options.provider.name,
      );
      error.usageReports = usageReports;
      throw error;
    }
    try {
      result = await options.provider.repair(
        { ...request, idempotencyKey: `${request.idempotencyKey}:repair:${attempt + 1}` },
        result.data,
        parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      );
    } catch (error) {
      if (error instanceof ProviderError)
        error.usageReports = [...usageReports, ...(error.usageReports ?? [])];
      throw error;
    }
    usageReports.push(...(result.usageReports ?? [result.usage]));
    usage = {
      ...result.usage,
      durationMs: usage.durationMs + result.usage.durationMs,
      costCents: usage.costCents + result.usage.costCents,
      inputTokens: (usage.inputTokens ?? 0) + (result.usage.inputTokens ?? 0),
      outputTokens: (usage.outputTokens ?? 0) + (result.usage.outputTokens ?? 0),
      costKnown: usage.costKnown !== false && result.usage.costKnown !== false,
    };
  }
  throw new ProviderError("Unreachable generation state", "UNKNOWN", false, options.provider.name);
}
