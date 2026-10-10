export type AiFeature = "intake" | "review" | "questions" | "grade" | "interview";
export type IntakeSource = "description" | "readme" | "repository";

export const WELCOME_CREDITS = 5;

const CREDIT_COST: Record<AiFeature, number> = {
  intake: 1,
  review: 2,
  questions: 1,
  grade: 0,
  interview: 1,
};

/** Credits for one AI run. Intake from a public repository costs 2; other intake sources cost 1. */
export function creditCost(feature: AiFeature, opts?: { source?: IntakeSource }): number {
  if (feature === "intake" && opts?.source === "repository") return 2;
  return CREDIT_COST[feature];
}

export const PACKS = [
  { id: "starter", credits: 15, priceUsd: 5 },
  { id: "standard", credits: 40, priceUsd: 12 },
  { id: "plus", credits: 100, priceUsd: 25 },
] as const;

export type PackId = (typeof PACKS)[number]["id"];

export function packById(id: string): (typeof PACKS)[number] | undefined {
  return PACKS.find((pack) => pack.id === id);
}

export const DAILY_LIMITS: Record<AiFeature, { free: number; purchaser: number }> = {
  intake: { free: 10, purchaser: 10 },
  review: { free: 10, purchaser: 10 },
  questions: { free: 10, purchaser: 10 },
  grade: { free: 20, purchaser: 100 },
  interview: { free: 5, purchaser: 5 },
};

export const FLAG_REFUNDS_PER_30_DAYS = 3;
export const MAX_CONCURRENT_RUNS = 2;
export const STALE_RUN_MINUTES = 10;
