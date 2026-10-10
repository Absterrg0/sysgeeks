import "server-only";

export type Features = { auth: boolean; db: boolean; ai: boolean; billing: boolean };

/** Empty and whitespace-only values count as unset, so `KEY=` in .env is absent. */
function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function numberOr(value: string | undefined, fallback: number): number {
  const trimmed = nonEmpty(value);
  const parsed = Number(trimmed);
  return trimmed !== undefined && Number.isFinite(parsed) ? parsed : fallback;
}

/** Anything other than "live_mode" is test mode, so a typo cannot charge real cards. */
function dodoEnvironment(value: string | undefined): "test_mode" | "live_mode" {
  return nonEmpty(value) === "live_mode" ? "live_mode" : "test_mode";
}

/** Reads process.env at call time. Server-side only; pass publicFeatures() to client components. */
export function features(): Features {
  const auth = Boolean(
    nonEmpty(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) && nonEmpty(process.env.CLERK_SECRET_KEY),
  );
  const db = Boolean(nonEmpty(process.env.DATABASE_URL));
  const ai =
    auth &&
    db &&
    process.env.AI_ENABLED !== "0" &&
    Boolean(nonEmpty(process.env.AI_GATEWAY_API_KEY) || process.env.VERCEL === "1");
  const billing =
    ai &&
    Boolean(
      nonEmpty(process.env.DODO_PAYMENTS_API_KEY) &&
        nonEmpty(process.env.DODO_PAYMENTS_WEBHOOK_KEY) &&
        nonEmpty(process.env.DODO_PRODUCT_PACK_STARTER) &&
        nonEmpty(process.env.DODO_PRODUCT_PACK_STANDARD) &&
        nonEmpty(process.env.DODO_PRODUCT_PACK_PLUS),
    );
  return { auth, db, ai, billing };
}

export function publicFeatures(): Pick<Features, "auth" | "ai" | "billing"> {
  const { auth, ai, billing } = features();
  return { auth, ai, billing };
}

export const env = {
  siteUrl: nonEmpty(process.env.SITE_URL) ?? "http://localhost:3000",
  aiDailyBudgetUsd: numberOr(process.env.AI_DAILY_BUDGET_USD, 25),
  zdr: process.env.AI_ZERO_DATA_RETENTION !== "0",
  models: {
    strong: nonEmpty(process.env.AI_MODEL_STRONG) ?? "anthropic/claude-sonnet-5.5",
    strongFallback: nonEmpty(process.env.AI_MODEL_STRONG_FALLBACK) ?? "openai/gpt-6.1-sol",
    fast: nonEmpty(process.env.AI_MODEL_FAST) ?? "anthropic/claude-haiku-5.5",
    fastFallback: nonEmpty(process.env.AI_MODEL_FAST_FALLBACK) ?? "openai/gpt-6-luna",
  },
  dodo: {
    environment: dodoEnvironment(process.env.DODO_PAYMENTS_ENVIRONMENT),
    products: {
      starter: nonEmpty(process.env.DODO_PRODUCT_PACK_STARTER),
      standard: nonEmpty(process.env.DODO_PRODUCT_PACK_STANDARD),
      plus: nonEmpty(process.env.DODO_PRODUCT_PACK_PLUS),
    },
  },
  githubToken: nonEmpty(process.env.GITHUB_TOKEN),
};
