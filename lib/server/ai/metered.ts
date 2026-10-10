import "server-only";
import { AiFailure, type AiErrorCode, type AiUsage } from "@/lib/ai/errors";
import type { AiEvent } from "@/lib/ai/events";
import { env } from "@/lib/config";
import { DAILY_LIMITS, MAX_CONCURRENT_RUNS, type AiFeature } from "@/lib/domain/pricing";
import {
  countRunning,
  countRunsToday,
  failRun,
  getAccountSummary,
  refundStaleRuns,
  reserveRun,
  type RunUsage,
  settleRun,
  spentTodayUsd,
} from "@/lib/server/billing/ledger";
import type { Db } from "@/lib/server/db";
import { estimateCostUsd, MODELS, type Tier } from "./models";

const RUN_TIMEOUT_MS = 240_000;

/** Largest model call a run can make: the prompt in characters, and the full output budget. */
export type WorstCase = { tier: Tier; inputChars: number; maxOutputTokens: number };

/** Both models may run (primary, then fallback), so the reservation covers both. */
function worstCaseUsd({ tier, inputChars, maxOutputTokens }: WorstCase): number {
  const inputTokens = Math.ceil(inputChars / 4);
  const { primary, fallback } = MODELS[tier];
  return (
    estimateCostUsd(primary, inputTokens, maxOutputTokens) + estimateCostUsd(fallback, inputTokens, maxOutputTokens)
  );
}

function dailyLimitFor(feature: AiFeature, hasPurchased: boolean): number {
  return DAILY_LIMITS[feature][hasPurchased ? "purchaser" : "free"];
}

/** Counts in-flight runs. Stale ones are swept first, so a killed run can't lock the user out. */
async function runningCount(db: Db, userId: string): Promise<number> {
  const running = await countRunning(db, userId);
  if (running < MAX_CONCURRENT_RUNS) return running;
  const swept = await refundStaleRuns(db, userId);
  return swept > 0 ? countRunning(db, userId) : running;
}

export async function checkLimits(
  db: Db,
  userId: string,
  feature: AiFeature,
  hasPurchased: boolean,
  credits: number,
): Promise<AiErrorCode | null> {
  const [runsToday, spentUsd] = await Promise.all([countRunsToday(db, userId, feature), spentTodayUsd(db)]);
  if (runsToday >= dailyLimitFor(feature, hasPurchased)) return "rate_limited";
  if ((await runningCount(db, userId)) >= MAX_CONCURRENT_RUNS) return "too_many_running";

  const budget = env.aiDailyBudgetUsd;
  if (spentUsd >= budget * 3) return "budget_exhausted";
  if (spentUsd > budget && (credits === 0 || !hasPurchased)) return "budget_exhausted";
  return null;
}

async function limitsFor(
  db: Db,
  userId: string,
  feature: AiFeature,
  credits: number,
): Promise<{ code: AiErrorCode | null; hasPurchased: boolean }> {
  const { balance, hasPurchased } = await getAccountSummary(db, userId);
  if (balance < credits) return { code: "insufficient_credits", hasPurchased };
  return { code: await checkLimits(db, userId, feature, hasPurchased, credits), hasPurchased };
}

/**
 * Cheap read-only check for routes to run before expensive work such as GitHub fetches.
 * reserveRun repeats the limit checks under a lock, so this is only an early exit.
 */
export async function precheckMetered(
  db: Db,
  userId: string,
  feature: AiFeature,
  credits: number,
): Promise<AiErrorCode | null> {
  return (await limitsFor(db, userId, feature, credits)).code;
}

function runUsageOf(usage: AiUsage): RunUsage {
  return {
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsd: usage.costUsd ?? estimateCostUsd(usage.model, usage.inputTokens, usage.outputTokens),
  };
}

export async function runMetered<T>(input: {
  db: Db;
  userId: string;
  feature: AiFeature;
  credits: number;
  projectId?: string;
  title?: string;
  modelHash?: string;
  inputSummary?: unknown;
  /** Reserved as the run's cost until it settles, so concurrent runs count against today's budget. */
  worstCase: WorstCase;
  emit?: (e: AiEvent) => void;
  execute: (ctx: { runId: string; signal: AbortSignal }) => Promise<{
    output: T;
    model: string;
    inputTokens: number;
    outputTokens: number;
    /** USD. When absent, estimated from the tokens and the model's price. */
    costUsd?: number;
  }>;
}): Promise<
  | { ok: true; runId: string; output: T }
  | { ok: false; runId: string | null; code: AiErrorCode; refunded: boolean; refundPending?: boolean }
> {
  const { db, userId, feature, credits, emit, execute } = input;

  await refundStaleRuns(db, userId);
  const { code: blocked, hasPurchased } = await limitsFor(db, userId, feature, credits);
  if (blocked) return { ok: false, runId: null, code: blocked, refunded: false };

  const runId = crypto.randomUUID();
  const reserved = await reserveRun(db, {
    userId,
    runId,
    feature,
    credits,
    projectId: input.projectId,
    title: input.title,
    modelHash: input.modelHash,
    inputSummary: input.inputSummary,
    estCostUsd: worstCaseUsd(input.worstCase),
    maxRunning: MAX_CONCURRENT_RUNS,
    dailyLimit: dailyLimitFor(feature, hasPurchased),
  });
  if (!reserved) {
    const raced = await checkLimits(db, userId, feature, hasPurchased, credits);
    return { ok: false, runId: null, code: raced ?? "insufficient_credits", refunded: false };
  }

  emit?.({ type: "progress", step: "started", runId });

  try {
    const result = await execute({ runId, signal: AbortSignal.timeout(RUN_TIMEOUT_MS) });
    await settleRun(db, {
      runId,
      output: result.output,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd ?? estimateCostUsd(result.model, result.inputTokens, result.outputTokens),
    });
    return { ok: true, runId, output: result.output };
  } catch (error) {
    const failureCode: AiErrorCode = error instanceof AiFailure ? error.code : "model_failed";
    const usage = error instanceof AiFailure ? error.usage : undefined;
    try {
      const { refunded } = await failRun(db, runId, failureCode, usage ? runUsageOf(usage) : undefined);
      return { ok: false, runId, code: failureCode, refunded: credits > 0 && refunded > 0 };
    } catch (refundError) {
      console.error(refundError);
      return { ok: false, runId, code: failureCode, refunded: false, refundPending: true };
    }
  }
}
