import { MockTextToSpeechProvider } from "./mock/media";
import { OpenAITextToSpeechProvider } from "./openai/tts";
import { ProviderError, type TextToSpeechProvider } from "./types";

type TtsInput = Parameters<TextToSpeechProvider["synthesize"]>[0];

/**
 * Applies the configured default voice without changing the existing
 * TextToSpeechProvider contract. Callers may still supply a voice override.
 */
class ConfiguredOpenAITextToSpeechProvider implements TextToSpeechProvider {
  readonly name = "openai";

  constructor(
    private readonly adapter: OpenAITextToSpeechProvider,
    readonly defaultVoice: string,
  ) {}

  validateConfiguration() {
    this.adapter.validateConfiguration();
  }

  healthCheck() {
    return this.adapter.healthCheck();
  }

  synthesize(input: TtsInput) {
    return this.adapter.synthesize({ ...input, voice: input.voice?.trim() || this.defaultVoice });
  }
}

/**
 * Selects TTS without network calls. Mock is the default, including in tests.
 * An explicitly selected real provider must be fully configured and can
 * never silently fall back to synthetic mock audio.
 */
export function createTtsProvider(source: NodeJS.ProcessEnv = process.env): TextToSpeechProvider {
  const selected = source.AI_TTS_PROVIDER ?? "mock";

  if (selected === "mock") return new MockTextToSpeechProvider();

  if (selected !== "openai") {
    throw new ProviderError(
      "AI_TTS_PROVIDER must be mock or openai",
      "INVALID_REQUEST",
      false,
      "tts",
    );
  }

  const apiKey = source.OPENAI_API_KEY?.trim();
  const model = source.OPENAI_TTS_MODEL?.trim();
  const voice = source.OPENAI_TTS_VOICE?.trim();
  const missing = [
    !apiKey && "OPENAI_API_KEY",
    !model && "OPENAI_TTS_MODEL",
    !voice && "OPENAI_TTS_VOICE",
  ].filter(Boolean);

  if (!apiKey || !model || !voice) {
    throw new ProviderError(
      `OpenAI TTS configuration required: ${missing.join(", ")}`,
      "INVALID_REQUEST",
      false,
      "openai",
    );
  }

  // Values were validated above. Never instantiate a network client in mock mode.
  const adapter = new OpenAITextToSpeechProvider(apiKey, model);
  adapter.validateConfiguration();
  return new ConfiguredOpenAITextToSpeechProvider(adapter, voice);
}
