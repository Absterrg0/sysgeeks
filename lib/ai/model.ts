/**
 * Turns the learner's key into a model the AI SDK can call, from the browser, straight to the provider.
 * Provider SDKs are imported on demand, so pages pay for them only when an AI run starts.
 */
import type { LanguageModel } from "ai";
import type { AiProvider } from "./providers";

export type ModelSettings = { provider: AiProvider; apiKey: string; model: string };

/** Sent as the app name and URL to providers that attribute traffic (OpenRouter). */
const APP_NAME = "SysGeeks";
const APP_URL = "https://www.sysgeeks.com";

export async function languageModel({ provider, apiKey, model }: ModelSettings): Promise<LanguageModel> {
  switch (provider) {
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      // Anthropic refuses browser requests (CORS) unless they opt in with this header.
      return createAnthropic({ apiKey, headers: { "anthropic-dangerous-direct-browser-access": "true" } })(model);
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      return createOpenAI({ apiKey })(model);
    }
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return createGoogleGenerativeAI({ apiKey })(model);
    }
    case "openrouter": {
      const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
      return createOpenRouter({
        apiKey,
        compatibility: "strict",
        appName: APP_NAME,
        appUrl: APP_URL,
        // Route only to upstream providers that honour the JSON schema.
        extraBody: { provider: { require_parameters: true } },
      })(model);
    }
  }
}

/**
 * Per-provider options for structured output. OpenAI's strict mode rejects optional fields, which the
 * schemas use, so it validates on our side instead (the zod schema still checks every answer).
 */
export const STRUCTURED_OUTPUT_OPTIONS = {
  openai: { strictJsonSchema: false },
} as const;

/** A free, read-only request that only succeeds with a valid key. */
export function keyCheckRequest({ provider, apiKey }: Omit<ModelSettings, "model">): { url: string; init: RequestInit } {
  switch (provider) {
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/models?limit=1000",
        init: {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
        },
      };
    case "openai":
      return { url: "https://api.openai.com/v1/models", init: { headers: { Authorization: `Bearer ${apiKey}` } } };
    case "google":
      // Only content-type and x-goog-api-key pass Gemini's CORS check, so send nothing else.
      return {
        url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
        init: { headers: { "x-goog-api-key": apiKey } },
      };
    case "openrouter":
      // The models list answers any key; this one checks it.
      return { url: "https://openrouter.ai/api/v1/key", init: { headers: { Authorization: `Bearer ${apiKey}` } } };
  }
}

/** Model ids a key-check response lists, when the provider lists them. */
export function listedModels(provider: AiProvider, json: unknown): string[] | null {
  if (typeof json !== "object" || json === null) return null;
  const record = json as Record<string, unknown>;
  if (provider === "google") {
    const models = record.models;
    if (!Array.isArray(models)) return null;
    return models.flatMap((m) =>
      typeof m === "object" && m !== null && typeof (m as { name?: unknown }).name === "string"
        ? [(m as { name: string }).name.replace(/^models\//, "")]
        : [],
    );
  }
  if (provider === "anthropic" || provider === "openai") {
    const data = record.data;
    if (!Array.isArray(data)) return null;
    return data.flatMap((m) =>
      typeof m === "object" && m !== null && typeof (m as { id?: unknown }).id === "string" ? [(m as { id: string }).id] : [],
    );
  }
  return null;
}
