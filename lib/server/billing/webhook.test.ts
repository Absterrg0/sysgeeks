import { PGlite } from "@electric-sql/pglite";
import type { DodoPayments } from "dodopayments";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db, SqlStep } from "@/lib/server/db";
import { handleDodoEvent } from "./dodo";
import * as ledger from "./ledger";

vi.hoisted(() => {
  process.env.DODO_PRODUCT_PACK_STARTER = "pdt_starter";
  process.env.DODO_PRODUCT_PACK_STANDARD = "pdt_standard";
  process.env.DODO_PRODUCT_PACK_PLUS = "pdt_plus";
});

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

const USER = "user_1";
const SESSION = "cs_1";

beforeEach(async () => {
  await pg.exec("truncate accounts, ledger, ai_runs, payments, checkouts cascade");
  await ledger.recordCheckout(db, { sessionId: SESSION, userId: USER, packId: "starter" });
});

type PaymentOptions = {
  productId?: string;
  sessionId?: string | null;
  cart?: Array<{ product_id: string; quantity: number }> | null;
};

/** Fixtures carry only the fields the handler reads, so they are cast to the SDK event type. */
function paymentEvent(paymentId: string, { productId = "pdt_starter", sessionId = SESSION, cart }: PaymentOptions = {}) {
  return {
    type: "payment.succeeded",
    business_id: "bus_1",
    timestamp: "2026-10-08T00:00:00Z",
    data: {
      payment_id: paymentId,
      checkout_session_id: sessionId,
      product_cart: cart === undefined ? [{ product_id: productId, quantity: 1 }] : cart,
      metadata: { userId: USER, packId: "starter" },
      total_amount: 500,
      currency: "USD",
      customer: { customer_id: "cus_1", email: "learner@example.com", name: "Learner" },
    },
  } as unknown as DodoPayments.UnwrapWebhookEvent;
}

function refundEvent(refundId: string, paymentId: string, amount: number | null, isPartial = false) {
  return {
    type: "refund.succeeded",
    business_id: "bus_1",
    timestamp: "2026-10-08T00:00:00Z",
    data: {
      refund_id: refundId,
      payment_id: paymentId,
      amount,
      is_partial: isPartial,
      status: "succeeded",
      metadata: {},
      customer: { customer_id: "cus_1", email: "learner@example.com", name: "Learner" },
    },
  } as unknown as DodoPayments.UnwrapWebhookEvent;
}

function disputeEvent(type: "dispute.opened" | "dispute.lost" | "dispute.accepted", disputeId: string, paymentId: string) {
  return {
    type,
    business_id: "bus_1",
    timestamp: "2026-10-08T00:00:00Z",
    data: {
      dispute_id: disputeId,
      payment_id: paymentId,
      business_id: "bus_1",
      amount: "5.00",
      currency: "USD",
      dispute_stage: "dispute",
      dispute_status: type === "dispute.lost" ? "dispute_lost" : "dispute_accepted",
      created_at: "2026-10-08T00:00:00Z",
    },
  } as unknown as DodoPayments.UnwrapWebhookEvent;
}

async function balanceOf(): Promise<number> {
  return (await ledger.getAccountSummary(db, USER)).balance;
}

async function countLedger(kind: string): Promise<number> {
  const rows = await db.query<{ n: number }>("select count(*)::int as n from ledger where kind = $1", [kind]);
  return rows[0]?.n ?? 0;
}

describe("handleDodoEvent", () => {
  it("grants the pack once when payment.succeeded is delivered twice", async () => {
    await handleDodoEvent(db, paymentEvent("pay_1"));
    await handleDodoEvent(db, paymentEvent("pay_1"));

    expect(await balanceOf()).toBe(15);
    expect(await countLedger("purchase")).toBe(1);
  });

  it("falls back to metadata.userId when there is no checkout row", async () => {
    await handleDodoEvent(db, paymentEvent("pay_1", { sessionId: null }));

    expect(await balanceOf()).toBe(15);
  });

  it("grants the checkout's pack when the payment has no product_cart", async () => {
    await handleDodoEvent(db, paymentEvent("pay_1", { cart: null }));

    expect(await balanceOf()).toBe(15);
  });

  it("grants the checkout's pack when the product is not a known pack", async () => {
    await handleDodoEvent(db, paymentEvent("pay_1", { productId: "pdt_unknown" }));

    expect(await balanceOf()).toBe(15);
  });

  it("ignores a payment with no known pack without granting or throwing", async () => {
    await expect(
      handleDodoEvent(db, paymentEvent("pay_1", { productId: "pdt_unknown", sessionId: null })),
    ).resolves.toBeUndefined();

    expect(await balanceOf()).toBe(0);
    expect(await countLedger("purchase")).toBe(0);
  });

  it("ignores a payment with a quantity above one", async () => {
    await expect(
      handleDodoEvent(db, paymentEvent("pay_1", { cart: [{ product_id: "pdt_starter", quantity: 2 }] })),
    ).resolves.toBeUndefined();

    expect(await balanceOf()).toBe(0);
    expect(await countLedger("purchase")).toBe(0);
  });

  it("ignores a payment with more than one line item", async () => {
    await expect(
      handleDodoEvent(
        db,
        paymentEvent("pay_1", {
          cart: [
            { product_id: "pdt_starter", quantity: 1 },
            { product_id: "pdt_standard", quantity: 1 },
          ],
        }),
      ),
    ).resolves.toBeUndefined();

    expect(await balanceOf()).toBe(0);
    expect(await countLedger("purchase")).toBe(0);
  });

  it("claws back the credits when a refund succeeds", async () => {
    await handleDodoEvent(db, paymentEvent("pay_1"));
    expect(await balanceOf()).toBe(15);

    await handleDodoEvent(db, refundEvent("ref_1", "pay_1", 500));

    expect(await balanceOf()).toBe(0);
    expect(await countLedger("refund-clawback")).toBe(1);
  });

  it("treats a replayed refund as a no-op", async () => {
    await handleDodoEvent(db, paymentEvent("pay_1"));
    await handleDodoEvent(db, paymentEvent("pay_2"));
    expect(await balanceOf()).toBe(30);

    await handleDodoEvent(db, refundEvent("ref_1", "pay_1", 500));
    await handleDodoEvent(db, refundEvent("ref_1", "pay_1", 500));

    expect(await balanceOf()).toBe(15);
    expect(await countLedger("refund-clawback")).toBe(1);
  });

  it("rejects a refund that arrives before its payment, then claws back once the payment is granted", async () => {
    await expect(handleDodoEvent(db, refundEvent("ref_1", "pay_1", 500))).rejects.toThrow("unknown payment");
    expect(await countLedger("refund-clawback")).toBe(0);

    await handleDodoEvent(db, paymentEvent("pay_1"));
    expect(await balanceOf()).toBe(15);

    await handleDodoEvent(db, refundEvent("ref_1", "pay_1", 500));
    expect(await balanceOf()).toBe(0);
  });

  it("rejects a partial refund with no amount without recording it", async () => {
    await handleDodoEvent(db, paymentEvent("pay_1"));

    await expect(handleDodoEvent(db, refundEvent("ref_1", "pay_1", null, true))).rejects.toThrow("has no amount");
    expect(await balanceOf()).toBe(15);
    expect(await countLedger("refund-clawback")).toBe(0);

    await handleDodoEvent(db, refundEvent("ref_1", "pay_1", 250, true));
    expect(await balanceOf()).toBe(8);
  });

  it("claws back the payment's credits when a dispute is lost, once", async () => {
    await handleDodoEvent(db, paymentEvent("pay_1"));
    await handleDodoEvent(db, paymentEvent("pay_2"));
    expect(await balanceOf()).toBe(30);

    await handleDodoEvent(db, disputeEvent("dispute.lost", "dsp_1", "pay_1"));
    await handleDodoEvent(db, disputeEvent("dispute.accepted", "dsp_1", "pay_1"));

    expect(await balanceOf()).toBe(15);
    expect(await countLedger("refund-clawback")).toBe(1);
  });

  it("rejects a dispute for a payment it has not seen, so Dodo retries it", async () => {
    await expect(handleDodoEvent(db, disputeEvent("dispute.lost", "dsp_1", "pay_1"))).rejects.toThrow(
      "unknown payment",
    );
    expect(await countLedger("refund-clawback")).toBe(0);
  });

  it("leaves credits alone when a dispute is opened", async () => {
    await handleDodoEvent(db, paymentEvent("pay_1"));

    await expect(handleDodoEvent(db, disputeEvent("dispute.opened", "dsp_1", "pay_1"))).resolves.toBeUndefined();
    expect(await balanceOf()).toBe(15);
  });
});
