# Provider contracts and setup

No API key is needed for the default mock workflow. Select capabilities explicitly; credentials alone do not activate a provider.

| Setting                                                         | Values / requirement                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| AI_TEXT_PROVIDER                                                | mock (default), openai, gemini                                     |
| AI_IMAGE_PROVIDER                                               | mock (default), openai                                             |
| OPENAI_API_KEY                                                  | Required for selected OpenAI capabilities                          |
| OPENAI_TEXT_MODEL                                               | Required for OpenAI text; select a Responses-compatible model      |
| OPENAI_IMAGE_MODEL                                              | Required for OpenAI image; select a GPT Image model supporting PNG |
| GEMINI_API_KEY, GEMINI_TEXT_MODEL                               | Required for Gemini text with Interactions                         |
| AI_FALLBACK_PROVIDER                                            | Optional openai or gemini; never mock                              |
| AI_TIMEOUT_MS                                                   | Optional text/router deadline, default 45000 ms                    |
| OPENAI_INPUT_CENTS_PER_MILLION, OPENAI_OUTPUT_CENTS_PER_MILLION | Optional operator-supplied token price estimates                   |
| GEMINI_INPUT_CENTS_PER_MILLION, GEMINI_OUTPUT_CENTS_PER_MILLION | Optional operator-supplied token price estimates                   |
| OPENAI_IMAGE_COST_CENTS                                         | Optional per-image estimate                                        |

Prices are estimates, not invoices. Unknown prices have `costKnown: false` in step output; zero in the cost column then does not mean a real call was free. Configure estimates before relying on recorded-spend admission checks. In-flight external spend is not reserved atomically, so these checks are not a guaranteed billing ceiling.

Official SDKs are pinned: `openai@7.15.0`, `@google/genai@2.22.0`, and `zod-to-json-schema@3.25.2`. OpenAI uses Responses JSON schema output; Gemini uses Interactions JSON output. Zod validates contracts with at most two schema repairs. Repair usage is cumulative and retained on validation failure. Transient errors can use an explicitly configured fallback; permanent errors fail cleanly. Health checks validate local configuration, not remote credentials.

The OpenAI image adapter invokes Images for PNG bytes and validates the returned signature/dimensions. Mocks produce deterministic PNG gradients and a playable WAV reference tone. Real video generation, speech and transcription remain provider boundaries. Real social and Stripe adapters need implementation as well as account setup.

References: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation), [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output). CI replaces SDK/HTTP boundaries and never makes paid calls.
