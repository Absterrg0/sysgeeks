/**
 * The AI providers a learner can bring their own key for, and the models offered for each.
 * Client-safe and dependency-free: the provider SDKs load only when a run starts (see `lib/ai/model.ts`).
 *
 * Model ids were checked against each provider's model list in November 2026. Any other id the
 * provider offers can be typed in as a custom model.
 */
export const AI_PROVIDERS = ["anthropic", "openai", "google", "openrouter"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export type ModelOption = { id: string; label: string; note: string };

export type ProviderInfo = {
  id: AiProvider;
  label: string;
  /** Where the learner creates a key. */
  keyUrl: string;
  /** A placeholder that shows the key's shape, never a real key. */
  keyPlaceholder: string;
  /** The first model is the default. */
  models: readonly ModelOption[];
};

export const PROVIDERS: Record<AiProvider, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    keyUrl: "https://platform.claude.com/settings/keys",
    keyPlaceholder: "sk-ant-…",
    models: [
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Balanced. $2 / $10 per million tokens in / out" },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Strongest everyday model. $4 / $20" },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Fastest and cheapest. $0.10 / $0.50" },
      { id: "claude-fable-5-2", label: "Claude Fable 5.2", note: "Hardest reasoning. $8 / $40" },
    ],
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-…",
    models: [
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", note: "Balanced. $2 / $10 per million tokens in / out" },
      { id: "gpt-6-astra", label: "GPT-6 Astra", note: "Flagship. $10 / $50" },
      { id: "gpt-6.1-terra", label: "GPT-6.1 Terra", note: "Cheaper. $1 / $5" },
      { id: "gpt-6-luna", label: "GPT-6 Luna", note: "Fastest and cheapest. $0.10 / $0.50" },
    ],
  },
  google: {
    id: "google",
    label: "Google Gemini",
    keyUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza…",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", note: "Recommended for new projects" },
      { id: "gemini-4-carbon", label: "Gemini 4 Carbon", note: "Strongest reasoning" },
      { id: "gemini-4-argon", label: "Gemini 4 Argon", note: "Efficient frontier model" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", note: "Fastest and cheapest" },
    ],
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    keyUrl: "https://openrouter.ai/settings/keys",
    keyPlaceholder: "sk-or-v1-…",
    models: [
      { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5", note: "Balanced" },
      { id: "openai/gpt-6.1-sol", label: "GPT-6.1 Sol", note: "Balanced" },
      { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", note: "Fast and cheap" },
      { id: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5", note: "Strongest" },
      { id: "deepseek/deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash", note: "Cheapest" },
    ],
  },
};

export function isProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && (AI_PROVIDERS as readonly string[]).includes(value);
}

export function defaultModel(provider: AiProvider): string {
  return PROVIDERS[provider].models[0]?.id ?? "";
}

/** "Claude Sonnet 5.5" for a listed model, the raw id for a custom one. */
export function modelLabel(provider: AiProvider, model: string): string {
  return PROVIDERS[provider].models.find((m) => m.id === model)?.label ?? model;
}

/** Model ids are free text when custom, so keep them to the characters provider ids use. */
export const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,199}$/;
