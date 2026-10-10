import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AiFailure } from "@/lib/ai/errors";
import { env } from "@/lib/config";
import { DAILY_LIMITS, MAX_CONCURRENT_RUNS, WELCOME_CREDITS, type AiFeature } from "@/lib/domain/pricing";
import * as ledger from "@/lib/server/billing/ledger";
import type { Db, SqlStep } from "@/lib/server/db";
import { checkLimits, precheckMetered, runMetered } from "./metered";
import { estimateCostUsd } from "./models";

const migration = readFileSync(new URL("../../../db/migrations/001_init.sql", import.meta.url), "utf8");
const costMigration = readFileSync(new URL("../../../db/migrations/002_cost_estimate.sql", import.meta.url), "utf8");

let pg: PGlite;
let db: Db;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(migration);
  await pg.exec(costMigration);
  db = {
    query: async <T = Record<string, unknown>>(text: string, params?: unknown[]) =>
      (await pg.query<T>(text, params)).rows,
    transaction: async <T = Record<string, unknown>>(steps: SqlStep[]) =>
      pg.transaction(async (tx) => {
        const out: T[][] = [];
        for (const step of steps) out.push((await tx.query<T>(step.text, step.params)).rows);
        return out;
      }),
  };
}, 60_000);

beforeEach(async () => {
  await pg.exec("truncate accounts, ledger, ai_runs, payments, checkouts cascade");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const USER = "user_1";
const HAIKU = "anthropic/claude-haiku-5.5";
const WORST_CASE = { tier: "fast" as const, inputChars: 4_000, maxOutputTokens: 2_000 };

type RunContext = { runId: string; signal: AbortSignal };

function succeeds() {
  return vi.fn(async (ctx: RunContext) => ({
    output: { runId: ctx.runId },
    model: HAIKU,
    inputTokens: 1_000,
    outputTokens: 200,
  }));
}

async function verifiedUser(): Promise<void> {
  await ledger.ensureAccount(db, USER, { verifiedEmail: true });
}

async function balanceOf(): Promise<number> {
  return (await ledger.getAccountSummary(db, USER)).balance;
}

async function seedRuns(
  feature: AiFeature,
  count: number,
  opts: { status?: "running" | "succeeded"; costUsd?: number } = {},
): Promise<void> {
  await db.query(
    `insert into ai_runs (id, user_id, feature, status, credits, cost_usd)
     select gen_random_uuid(), $1::text, $2::text, $3::text, 0, $4::numeric
     from generate_series(1, $5::int)`,
    [USER, feature, opts.status ?? "succeeded", opts.costUsd ?? 0, count],
  );
}

async function seedStaleRuns(count: number): Promise<void> {
  await db.query(
    `insert into ai_runs (id, user_id, feature, status, credits, created_at)
     select gen_random_uuid(), $1::text, 'review', 'running', 0, now() - interval '1 hour'
     from generate_series(1, $2::int)`,
    [USER, count],
  );
}

async function runStatus(): Promise<{ status: string; errorCode: string | null; refunded: boolean }[]> {
  return db.query<{ status: string; errorCode: string | null; refunded: boolean }>(
    `select status, error_code as "errorCode", refunded from ai_runs`,
  );
}

describe("runMetered", () => {
  it("settles a successful run and emits progress", async () => {
    await verifiedUser();
    const emit = vi.fn();
    const execute = succeeds();

    const result = await runMetered({
      db,
      userId: USER,
      feature: "intake",
      credits: 1,
      worstCase: WORST_CASE,
      emit,
      execute,
    });

    expect(result).toMatchObject({ ok: true, output: { runId: expect.any(String) } });
    if (!result.ok) return;
    expect(execute).toHaveBeenCalledOnce();
    const ctx = execute.mock.calls[0]?.[0];
    expect(ctx?.runId).toBe(result.runId);
    expect(ctx?.signal).toBeInstanceOf(AbortSignal);
    expect(emit).toHaveBeenCalledWith({ type: "progress", step: "started", runId: result.runId });
    expect(await balanceOf()).toBe(WELCOME_CREDITS - 1);

    const run = await ledger.getRun(db, USER, result.runId);
    expect(run?.status).toBe("succeeded");
    expect(run?.model).toBe(HAIKU);
    expect(run?.costUsd).toBeCloseTo(estimateCostUsd(HAIKU, 1_000, 200), 5);
  });

  it("settles with the cost the execute step reports", async () => {
    await verifiedUser();
    const execute = vi.fn(async () => ({
      output: { ok: true },
      model: HAIKU,
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0.42,
    }));

    const result = await runMetered({
      db,
      userId: USER,
      feature: "review",
      credits: 2,
      worstCase: WORST_CASE,
      execute,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await ledger.getRun(db, USER, result.runId))?.costUsd).toBeCloseTo(0.42, 5);
  });

  it("refunds the credits when execute throws an AiFailure", async () => {
    await verifiedUser();
    const execute = vi.fn(async () => {
      throw new AiFailure("invalid_output");
    });

    const result = await runMetered({
      db,
      userId: USER,
      feature: "intake",
      credits: 2,
      worstCase: WORST_CASE,
      execute,
    });

    expect(result).toMatchObject({ ok: false, runId: expect.any(String), code: "invalid_output", refunded: true });
    expect(await balanceOf()).toBe(WELCOME_CREDITS);
    expect(await runStatus()).toEqual([{ status: "failed", errorCode: "invalid_output", refunded: true }]);
  });

  it("charges the usage a failed run reports, and counts the run toward today's limit", async () => {
    await verifiedUser();
    const usage = { model: HAIKU, inputTokens: 40_000, outputTokens: 8_000 };
    const execute = vi.fn(async () => {
      throw new AiFailure("invalid_output", { usage });
    });

    const result = await runMetered({
      db,
      userId: USER,
      feature: "intake",
      credits: 2,
      worstCase: WORST_CASE,
      execute,
    });

    expect(result).toMatchObject({ ok: false, code: "invalid_output", refunded: true });
    expect(await balanceOf()).toBe(WELCOME_CREDITS);
    if (!result.ok && result.runId) {
      const run = await ledger.getRun(db, USER, result.runId);
      expect(run?.costUsd).toBeCloseTo(estimateCostUsd(HAIKU, 40_000, 8_000), 5);
      expect(run?.costUsd).toBeGreaterThan(0);
    }
    expect(await ledger.countRunsToday(db, USER, "intake")).toBe(1);
  });

  it("maps other errors to model_failed and refunds", async () => {
    await verifiedUser();
    const execute = vi.fn(async () => {
      throw new Error("socket hang up");
    });

    const result = await runMetered({
      db,
      userId: USER,
      feature: "review",
      credits: 2,
      worstCase: WORST_CASE,
      execute,
    });

    expect(result).toMatchObject({ ok: false, code: "model_failed", refunded: true });
    expect(await balanceOf()).toBe(WELCOME_CREDITS);
  });

  it("reports no refund for a free run that fails", async () => {
    await verifiedUser();
    const execute = vi.fn(async () => {
      throw new AiFailure("timeout");
    });

    const result = await runMetered({ db, userId: USER, feature: "grade", credits: 0, worstCase: WORST_CASE, execute });

    expect(result).toMatchObject({ ok: false, code: "timeout", refunded: false });
    expect(await balanceOf()).toBe(WELCOME_CREDITS);
  });

  it("reports refundPending when the refund cannot be written", async () => {
    await verifiedUser();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const flaky: Db = {
      query: async <T = Record<string, unknown>>(text: string, params?: unknown[]) => {
        if (text.includes("error_code = $2::text")) throw new Error("connection reset");
        return db.query<T>(text, params);
      },
      transaction: db.transaction,
    };
    const execute = vi.fn(async () => {
      throw new AiFailure("timeout");
    });

    const result = await runMetered({
      db: flaky,
      userId: USER,
      feature: "review",
      credits: 2,
      worstCase: WORST_CASE,
      execute,
    });

    expect(result).toEqual({
      ok: false,
      runId: expect.any(String),
      code: "timeout",
      refunded: false,
      refundPending: true,
    });
    expect(await balanceOf()).toBe(WELCOME_CREDITS - 2);
    expect(await runStatus()).toEqual([{ status: "running", errorCode: null, refunded: false }]);
  });

  it("never calls execute when the balance is short", async () => {
    await verifiedUser();
    const execute = succeeds();

    const result = await runMetered({
      db,
      userId: USER,
      feature: "review",
      credits: WELCOME_CREDITS + 1,
      worstCase: WORST_CASE,
      execute,
    });

    expect(result).toEqual({ ok: false, runId: null, code: "insufficient_credits", refunded: false });
    expect(execute).not.toHaveBeenCalled();
    expect(await balanceOf()).toBe(WELCOME_CREDITS);
    expect(await runStatus()).toEqual([]);
  });

  it("returns rate_limited at the daily limit without reserving", async () => {
    await verifiedUser();
    await seedRuns("intake", DAILY_LIMITS.intake.free);
    const execute = succeeds();

    const result = await runMetered({
      db,
      userId: USER,
      feature: "intake",
      credits: 1,
      worstCase: WORST_CASE,
      execute,
    });

    expect(result).toEqual({ ok: false, runId: null, code: "rate_limited", refunded: false });
    expect(execute).not.toHaveBeenCalled();
    expect(await balanceOf()).toBe(WELCOME_CREDITS);
  });

  it("returns too_many_running while the user already has the maximum runs in progress", async () => {
    await verifiedUser();
    await seedRuns("review", MAX_CONCURRENT_RUNS, { status: "running" });
    const execute = succeeds();

    const result = await runMetered({
      db,
      userId: USER,
      feature: "review",
      credits: 2,
      worstCase: WORST_CASE,
      execute,
    });

    expect(result).toEqual({ ok: false, runId: null, code: "too_many_running", refunded: false });
    expect(execute).not.toHaveBeenCalled();
    expect(await balanceOf()).toBe(WELCOME_CREDITS);
  });

  it("sweeps stale running runs before it applies the concurrency cap", async () => {
    await verifiedUser();
    await seedStaleRuns(MAX_CONCURRENT_RUNS);

    const result = await runMetered({
      db,
      userId: USER,
      feature: "review",
      credits: 2,
      worstCase: WORST_CASE,
      execute: succeeds(),
    });

    expect(result.ok).toBe(true);
    expect(await ledger.countRunning(db, USER)).toBe(0);
  });

  it("holds the daily limit when runs start together", async () => {
    await verifiedUser();
    const limit = DAILY_LIMITS.interview.free;

    const results = await Promise.all(
      Array.from({ length: limit + 3 }, () =>
        runMetered({ db, userId: USER, feature: "interview", credits: 0, worstCase: WORST_CASE, execute: succeeds() }),
      ),
    );

    const started = results.filter((result) => result.ok).length;
    expect(started).toBeGreaterThan(0);
    expect(started).toBeLessThanOrEqual(limit);
    expect(await ledger.countRunsToday(db, USER, "interview")).toBeLessThanOrEqual(limit);
  });
});

describe("precheckMetered", () => {
  it("reports insufficient_credits and the limits without reserving anything", async () => {
    await verifiedUser();

    expect(await precheckMetered(db, USER, "review", WELCOME_CREDITS + 1)).toBe("insufficient_credits");
    expect(await precheckMetered(db, USER, "review", 2)).toBeNull();
    expect(await runStatus()).toEqual([]);
  });

  it("sweeps stale running runs before it reports the concurrency cap", async () => {
    await verifiedUser();
    await seedStaleRuns(MAX_CONCURRENT_RUNS);

    expect(await precheckMetered(db, USER, "review", 2)).toBeNull();
  });
});

describe("checkLimits", () => {
  it("gives purchasers the higher grade limit", async () => {
    await verifiedUser();
    await seedRuns("grade", DAILY_LIMITS.grade.free);

    expect(await checkLimits(db, USER, "grade", false, 0)).toBe("rate_limited");
    expect(await checkLimits(db, USER, "grade", true, 0)).toBeNull();
  });

  it("pauses free runs and runs by accounts without a purchase once today's spend passes the budget", async () => {
    await verifiedUser();
    await seedRuns("review", 1, { costUsd: env.aiDailyBudgetUsd + 1 });

    expect(await checkLimits(db, USER, "grade", false, 0)).toBe("budget_exhausted");
    expect(await checkLimits(db, USER, "review", false, 2)).toBe("budget_exhausted");
    expect(await checkLimits(db, USER, "review", true, 2)).toBeNull();
  });

  it("lets purchasers' paid runs continue until three times the budget", async () => {
    await verifiedUser();
    await seedRuns("review", 1, { costUsd: env.aiDailyBudgetUsd * 2 });
    expect(await checkLimits(db, USER, "review", true, 2)).toBeNull();

    await seedRuns("review", 1, { costUsd: env.aiDailyBudgetUsd });
    expect(await checkLimits(db, USER, "review", true, 2)).toBe("budget_exhausted");
  });
});
