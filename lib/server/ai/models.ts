import "server-only";
import { env } from "@/lib/config";

export type Tier = "strong" | "fast";

export const MODELS: Record<Tier, { primary: string; fallback: string }> = {
  strong: { primary: env.models.strong, fallback: env.models.strongFallback },
  fast: { primary: env.models.fast, fallback: env.models.fastFallback },
};

/** USD per 1M tokens. */
export type Price = { in: number; out: number };

const SONNET: Price = { in: 2, out: 10 };

export const PRICES: Record<string, Price> = {
  "anthropic/claude-sonnet-5.5": SONNET,
  "anthropic/claude-haiku-5.5": { in: 0.1, out: 0.5 },
  "openai/gpt-6.1-sol": { in: 2, out: 10 },
  "openai/gpt-6-luna": { in: 0.1, out: 0.5 },
};

const unpriced = new Set<string>();

/** Unknown models (e.g. env overrides) use the most expensive known price, so budgets over-count rather than under-count. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model];
  if (!price && !unpriced.has(model)) {
    unpriced.add(model);
    console.warn(`No price for model ${model}; estimating at the highest known price.`);
  }
  const { in: inPrice, out: outPrice } = price ?? SONNET;
  return (inputTokens * inPrice + outputTokens * outPrice) / 1_000_000;
}
