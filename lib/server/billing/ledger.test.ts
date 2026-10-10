import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FLAG_REFUNDS_PER_30_DAYS, MAX_CONCURRENT_RUNS, WELCOME_CREDITS, type AiFeature } from "@/lib/domain/pricing";
import type { Db, SqlStep } from "@/lib/server/db";
import * as ledger from "./ledger";

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

const USER = "user_1";

async function balanceOf(userId = USER): Promise<number> {
  return (await ledger.getAccountSummary(db, userId)).balance;
}

async function verifiedUser(userId = USER): Promise<void> {
  await ledger.ensureAccount(db, userId, { verifiedEmail: true });
}

async function reserve(credits: number, userId = USER, feature: AiFeature = "review"): Promise<string> {
  const runId = randomUUID();
  const ok = await ledger.reserveRun(db, { userId, runId, feature, credits });
  expect(ok).toBe(true);
  return runId;
}

async function countLedger(kind: string): Promise<number> {
  const rows = await db.query<{ n: number }>("select count(*)::int as n from ledger where kind = $1", [kind]);
  return rows[0]?.n ?? 0;
}

async function grant(paymentId: string, credits: number, amount: number, userId = USER) {
  return ledger.grantPurchase(db, {
    paymentId,
    userId,
    packId: "starter",
    credits,
    amount,
    currency: "usd",
    customerId: "cus_1",
  });
}

describe("ensureAccount", () => {
  it("grants the welcome credits once, and only once the email is verified", async () => {
    await ledger.ensureAccount(db, USER, { verifiedEmail: false });
    expect(await balanceOf()).toBe(0);
    expect(await ledger.hasWelcome(db, USER)).toBe(false);

    await ledger.ensureAccount(db, USER, { verifiedEmail: true });
    expect(await balanceOf()).toBe(WELCOME_CREDITS);
    expect(await ledger.hasWelcome(db, USER)).toBe(true);

    await ledger.ensureAccount(db, USER, { verifiedEmail: true });
    expect(await balanceOf()).toBe(WELCOME_CREDITS);
    expect(await countLedger("welcome")).toBe(1);
  });
});

describe("reserveRun, settleRun and failRun", () => {
  it("returns false and leaves the balance unchanged when the balance is short", async () => {
    await verifiedUser();
    const ok = await ledger.reserveRun(db, {
      userId: USER,
      runId: randomUUID(),
      feature: "review",
      credits: WELCOME_CREDITS + 1,
    });
    expect(ok).toBe(false);
    expect(await balanceOf()).toBe(WELCOME_CREDITS);
    expect(await ledger.countRunsToday(db, USER, "review")).toBe(0);
  });

  it("refunds a failed run exactly once", async () => {
    await verifiedUser();
    const runId = await reserve(2);
    expect(await balanceOf()).toBe(WELCOME_CREDITS - 2);

    expect(await ledger.failRun(db, runId, "model_error")).toEqual({ refunded: 2 });
    expect(await balanceOf()).toBe(WELCOME_CREDITS);

    expect(await ledger.failRun(db, runId, "model_error")).toEqual({ refunded: 0 });
    expect(await balanceOf()).toBe(WELCOME_CREDITS);
    expect(await countLedger("run-refund")).toBe(1);
  });

  it("makes settling a failed run a no-op", async () => {
    await verifiedUser();
    const runId = await reserve(1);
    await ledger.failRun(db, runId, "model_error");

    const settled = await ledger.settleRun(db, {
      runId,
      output: { ok: true },
      model: "m",
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0.01,
    });
    expect(settled).toBe(false);
    expect((await ledger.getRun(db, USER, runId))?.status).toBe("failed");
    expect(await balanceOf()).toBe(WELCOME_CREDITS);
  });

  it("does not refund a run that was settled and then failed", async () => {
    await verifiedUser();
    const runId = await reserve(1);
    const settled = await ledger.settleRun(db, {
      runId,
      output: { ok: true },
      model: "m",
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0.01,
    });
    expect(settled).toBe(true);

    expect(await ledger.failRun(db, runId, "late_error")).toEqual({ refunded: 0 });
    expect(await balanceOf()).toBe(WELCOME_CREDITS - 1);
  });
});

describe("flagRun", () => {
  it("refunds a flagged run once", async () => {
    await verifiedUser();
    const runId = await reserve(2);
    await ledger.settleRun(db, { runId, output: {}, model: "m", inputTokens: 1, outputTokens: 1, costUsd: 0 });

    expect(await ledger.flagRun(db, { userId: USER, runId, reason: "wrong" })).toEqual({ ok: true, refunded: 2 });
    expect(await balanceOf()).toBe(WELCOME_CREDITS);

    expect(await ledger.flagRun(db, { userId: USER, runId, reason: "wrong" })).toEqual({
      ok: false,
      refunded: 0,
      reason: "already-flagged",
    });
    expect(await balanceOf()).toBe(WELCOME_CREDITS);
  });

  it("caps flags at 3 per 30 days", async () => {
    await verifiedUser();
    const runIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const runId = await reserve(1);
      await ledger.settleRun(db, { runId, output: {}, model: "m", inputTokens: 1, outputTokens: 1, costUsd: 0 });
      runIds.push(runId);
    }
    expect(await balanceOf()).toBe(WELCOME_CREDITS - 4);

    for (const runId of runIds.slice(0, 3)) {
      expect(await ledger.flagRun(db, { userId: USER, runId, reason: "wrong" })).toEqual({ ok: true, refunded: 1 });
    }
    expect(await ledger.flagRun(db, { userId: USER, runId: runIds[3]!, reason: "wrong" })).toEqual({
      ok: false,
      refunded: 0,
      reason: "limit",
    });
    expect(await balanceOf()).toBe(WELCOME_CREDITS - 1);
  });

  it("reports unknown runs and runs owned by someone else as not found", async () => {
    await verifiedUser();
    await verifiedUser("user_2");
    const runId = await reserve(1, "user_2");
    await ledger.settleRun(db, { runId, output: {}, model: "m", inputTokens: 1, outputTokens: 1, costUsd: 0 });

    expect(await ledger.flagRun(db, { userId: USER, runId, reason: "wrong" })).toEqual({
      ok: false,
      refunded: 0,
      reason: "not-found",
    });
  });
});

describe("refundStaleRuns", () => {
  it("refunds runs that have been running for more than 10 minutes", async () => {
    await verifiedUser();
    const staleRunId = await reserve(1);
    await reserve(2);
    await pg.query("update ai_runs set created_at = now() - interval '11 minutes' where id = $1::uuid", [staleRunId]);

    expect(await ledger.refundStaleRuns(db, USER)).toBe(1);
    expect(await balanceOf()).toBe(WELCOME_CREDITS - 2);
    expect(await ledger.countRunning(db, USER)).toBe(1);
    expect((await ledger.getRun(db, USER, staleRunId))?.errorCode).toBe("timeout");

    expect(await ledger.refundStaleRuns(db, USER)).toBe(0);
    expect(await balanceOf()).toBe(WELCOME_CREDITS - 2);
  });
});

describe("grantPurchase", () => {
  it("is idempotent on payment_id", async () => {
    expect(await grant("pay_1", 15, 500)).toEqual({ granted: true });
    expect(await balanceOf()).toBe(15);

    expect(await grant("pay_1", 15, 500)).toEqual({ granted: false });
    expect(await balanceOf()).toBe(15);

    expect(await ledger.getAccountSummary(db, USER)).toEqual({
      balance: 15,
      hasPurchased: true,
      dodoCustomerId: "cus_1",
    });
  });
});

describe("clawbackRefund", () => {
  it("claws back only the remaining balance on a full refund and never goes negative", async () => {
    await grant("pay_1", 15, 500);
    await reserve(10);
    expect(await balanceOf()).toBe(5);

    expect(
      await ledger.clawbackRefund(db, { refundId: "ref_1", paymentId: "pay_1", amount: 500, isPartial: false }),
    ).toEqual({ removed: 5, found: true });
    expect(await balanceOf()).toBe(0);
  });

  it("claws back a partial refund in proportion to the amount refunded", async () => {
    await grant("pay_1", 15, 500);

    expect(
      await ledger.clawbackRefund(db, { refundId: "ref_1", paymentId: "pay_1", amount: 200, isPartial: true }),
    ).toEqual({ removed: 6, found: true });
    expect(await balanceOf()).toBe(9);

    expect(
      await ledger.clawbackRefund(db, { refundId: "ref_2", paymentId: "pay_1", amount: 300, isPartial: false }),
    ).toEqual({ removed: 9, found: true });
    expect(await balanceOf()).toBe(0);
  });

  it("treats a replayed refund as a no-op", async () => {
    await grant("pay_1", 15, 500);
    const refund = { refundId: "ref_1", paymentId: "pay_1", amount: 250, isPartial: true };

    expect(await ledger.clawbackRefund(db, refund)).toEqual({ removed: 7, found: true });
    expect(await balanceOf()).toBe(8);

    expect(await ledger.clawbackRefund(db, refund)).toEqual({ removed: 0, found: true });
    expect(await balanceOf()).toBe(8);
    expect(await countLedger("refund-clawback")).toBe(1);
  });

  it("reports a refund for an unknown payment as not found and claws nothing back", async () => {
    await verifiedUser();
    expect(
      await ledger.clawbackRefund(db, { refundId: "ref_1", paymentId: "pay_missing", amount: 500, isPartial: false }),
    ).toEqual({ removed: 0, found: false });
    expect(await countLedger("refund-clawback")).toBe(0);
  });
});

describe("checkouts", () => {
  it("returns the user and pack recorded when the checkout was created", async () => {
    await verifiedUser();
    await ledger.recordCheckout(db, { sessionId: "cs_1", userId: USER, packId: "starter" });

    expect(await ledger.checkoutFor(db, "cs_1")).toEqual({ userId: USER, packId: "starter" });
    expect(await ledger.userForCheckout(db, "cs_1")).toBe(USER);
    expect(await ledger.checkoutFor(db, "cs_missing")).toBeNull();
  });
});

describe("flag eligibility", () => {
  it("rejects failed runs and runs outside review and questions as not-eligible", async () => {
    await verifiedUser();
    const failedRunId = await reserve(1);
    await ledger.failRun(db, failedRunId, "model_error");
    const intakeRunId = await reserve(1, USER, "intake");
    await ledger.settleRun(db, { runId: intakeRunId, output: {}, model: "m", inputTokens: 1, outputTokens: 1, costUsd: 0 });

    for (const runId of [failedRunId, intakeRunId]) {
      expect(await ledger.flagRun(db, { userId: USER, runId, reason: "wrong" })).toEqual({
        ok: false,
        refunded: 0,
        reason: "not-eligible",
      });
    }
    expect(await balanceOf()).toBe(WELCOME_CREDITS - 1);
  });
});

// PGlite runs every statement on one connection, so these Promise.all calls are serialised here.
// They prove the limit conditions hold for every reservation or flag. They cannot reproduce the
// READ COMMITTED interleaving that the advisory lock prevents; the lock is asserted separately.
describe("concurrent requests", () => {
  it("cannot flag more than FLAG_REFUNDS_PER_30_DAYS runs", async () => {
    await verifiedUser();
    const runIds: string[] = [];
    for (let i = 0; i < WELCOME_CREDITS; i++) {
      const runId = await reserve(1);
      await ledger.settleRun(db, { runId, output: {}, model: "m", inputTokens: 1, outputTokens: 1, costUsd: 0 });
      runIds.push(runId);
    }

    const results = await Promise.all(
      runIds.map((runId) => ledger.flagRun(db, { userId: USER, runId, reason: "wrong" })),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(FLAG_REFUNDS_PER_30_DAYS);
    expect(results.filter((result) => result.reason === "limit")).toHaveLength(
      runIds.length - FLAG_REFUNDS_PER_30_DAYS,
    );
    expect(await balanceOf()).toBe(WELCOME_CREDITS - runIds.length + FLAG_REFUNDS_PER_30_DAYS);
  });

  it("cannot reserve past MAX_CONCURRENT_RUNS", async () => {
    await verifiedUser();
    const reserved = await Promise.all(
      Array.from({ length: 5 }, () =>
        ledger.reserveRun(db, {
          userId: USER,
          runId: randomUUID(),
          feature: "review",
          credits: 0,
          maxRunning: MAX_CONCURRENT_RUNS,
        }),
      ),
    );
    expect(reserved.filter(Boolean)).toHaveLength(MAX_CONCURRENT_RUNS);
    expect(await ledger.countRunning(db, USER)).toBe(MAX_CONCURRENT_RUNS);
  });

  it("cannot reserve past the daily limit, including failed runs", async () => {
    await verifiedUser();
    const reserved = await Promise.all(
      Array.from({ length: 5 }, () =>
        ledger.reserveRun(db, { userId: USER, runId: randomUUID(), feature: "grade", credits: 0, dailyLimit: 3 }),
      ),
    );
    expect(reserved.filter(Boolean)).toHaveLength(3);
    expect(await ledger.countRunsToday(db, USER, "grade")).toBe(3);
  });

  it("cannot overdraw the balance", async () => {
    await verifiedUser();
    const reserved = await Promise.all(
      Array.from({ length: 5 }, () =>
        ledger.reserveRun(db, { userId: USER, runId: randomUUID(), feature: "intake", credits: 2 }),
      ),
    );
    expect(reserved.filter(Boolean)).toHaveLength(2);
    expect(await balanceOf()).toBe(WELCOME_CREDITS - 4);
  });

  it("takes the per-user advisory lock as the first step of reserve and flag transactions", async () => {
    await verifiedUser();
    const transaction = vi.spyOn(db, "transaction");
    const runId = await reserve(1);
    await ledger.settleRun(db, { runId, output: {}, model: "m", inputTokens: 1, outputTokens: 1, costUsd: 0 });
    await ledger.flagRun(db, { userId: USER, runId, reason: "wrong" });

    expect(transaction).toHaveBeenCalledTimes(2);
    for (const [steps] of transaction.mock.calls) {
      expect(steps[0]).toEqual({ text: expect.stringContaining("pg_advisory_xact_lock"), params: [USER] });
    }
    transaction.mockRestore();
  });
});

describe("run accounting", () => {
  it("records the usage of a failed run and counts its cost toward today's spend", async () => {
    await verifiedUser();
    const runId = await reserve(2);
    const usage = { model: "anthropic/claude-sonnet", inputTokens: 12000, outputTokens: 4000, costUsd: 0.09 };

    expect(await ledger.failRun(db, runId, "invalid_output", usage)).toEqual({ refunded: 2 });
    expect(await balanceOf()).toBe(WELCOME_CREDITS);

    expect(await ledger.getRun(db, USER, runId)).toMatchObject({
      status: "failed",
      refunded: true,
      errorCode: "invalid_output",
      model: usage.model,
      inputTokens: 12000,
      outputTokens: 4000,
    });
    expect((await ledger.getRun(db, USER, runId))?.costUsd).toBeCloseTo(0.09);
    expect(await ledger.spentTodayUsd(db)).toBeCloseTo(0.09);
  });

  it("counts failed runs toward the daily count", async () => {
    await verifiedUser();
    const runId = await reserve(1);
    await ledger.failRun(db, runId, "model_error");

    expect(await ledger.countRunsToday(db, USER, "review")).toBe(1);
  });

  it("counts the estimated cost of a running run until it settles", async () => {
    await verifiedUser();
    const runId = randomUUID();
    await ledger.reserveRun(db, { userId: USER, runId, feature: "review", credits: 1, estCostUsd: 0.05 });
    expect(await ledger.spentTodayUsd(db)).toBeCloseTo(0.05);

    await ledger.settleRun(db, { runId, output: {}, model: "m", inputTokens: 1, outputTokens: 1, costUsd: 0.01 });
    expect(await ledger.spentTodayUsd(db)).toBeCloseTo(0.01);
  });

  it("stores the input summary when the run settles", async () => {
    await verifiedUser();
    const runId = await reserve(1);
    await ledger.settleRun(db, {
      runId,
      output: {},
      model: "m",
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0,
      inputSummary: { source: "repo" },
    });

    expect((await ledger.getRun(db, USER, runId))?.inputSummary).toEqual({ source: "repo" });
  });
});

describe("run history", () => {
  it("lists runs and deletes their stored content but keeps the ledger", async () => {
    await verifiedUser();
    const runId = await reserve(1);
    await ledger.settleRun(db, {
      runId,
      output: { text: "hi" },
      model: "m",
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0.001,
    });

    expect((await ledger.listRuns(db, USER)).map((run) => run.id)).toEqual([runId]);
    expect((await ledger.getRun(db, USER, runId))?.output).toEqual({ text: "hi" });

    expect(await ledger.deleteRunData(db, USER, runId)).toBe(true);
    expect((await ledger.getRun(db, USER, runId))?.output).toBeNull();
    expect((await ledger.listLedger(db, USER)).map((entry) => entry.kind)).toEqual(["run", "welcome"]);
  });
});
