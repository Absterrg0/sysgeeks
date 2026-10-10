import "server-only";
import { DodoPayments } from "dodopayments";
import { env, features } from "@/lib/config";
import { PACKS, packById, type PackId } from "@/lib/domain/pricing";
import { checkoutFor, clawbackRefund, grantPurchase } from "@/lib/server/billing/ledger";
import type { Db } from "@/lib/server/db";

let client: DodoPayments | undefined;

export function getDodo(): DodoPayments | null {
  if (!features().billing) return null;
  client ??= new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
    environment: env.dodo.environment,
  });
  return client;
}

export function productForPack(packId: PackId): string | null {
  return env.dodo.products[packId] ?? null;
}

export function packForProduct(productId: string | null | undefined): PackId | null {
  if (!productId) return null;
  return PACKS.find((pack) => env.dodo.products[pack.id] === productId)?.id ?? null;
}

export async function handleDodoEvent(db: Db, event: DodoPayments.UnwrapWebhookEvent): Promise<void> {
  switch (event.type) {
    case "payment.succeeded":
      return grantFromPayment(db, event.data);
    case "refund.succeeded":
      return clawbackFromRefund(db, event.data);
    case "dispute.opened":
      console.warn("dodo: dispute opened", event.data.payment_id, event.data.dispute_id);
      return;
    case "dispute.lost":
    case "dispute.accepted":
      return clawbackFromDispute(db, event.data);
    default:
      return;
  }
}

function unmatched(paymentId: string, reason: string): void {
  console.error("dodo-unmatched", "payment", paymentId, reason);
}

async function grantFromPayment(db: Db, payment: DodoPayments.Payment): Promise<void> {
  const checkout = payment.checkout_session_id ? await checkoutFor(db, payment.checkout_session_id) : null;
  const metadataUser = payment.metadata?.userId;
  const userId = checkout?.userId ?? (typeof metadataUser === "string" ? metadataUser : null);
  if (!userId) return unmatched(payment.payment_id, "no known user");

  const cart = payment.product_cart ?? [];
  if (cart.length > 1 || cart.some((item) => item.quantity > 1)) {
    return unmatched(payment.payment_id, "cart has more than one unit");
  }

  const packId = packForProduct(cart[0]?.product_id) ?? checkout?.packId;
  const pack = packId ? packById(packId) : undefined;
  if (!pack) return unmatched(payment.payment_id, "no known pack");

  await grantPurchase(db, {
    paymentId: payment.payment_id,
    userId,
    packId: pack.id,
    credits: pack.credits,
    amount: payment.total_amount,
    currency: payment.currency,
    customerId: payment.customer.customer_id,
  });
}

async function clawbackFromRefund(db: Db, refund: DodoPayments.Refund): Promise<void> {
  if (refund.is_partial && refund.amount == null) {
    throw new Error(`partial refund ${refund.refund_id} has no amount`);
  }
  const { found } = await clawbackRefund(db, {
    refundId: refund.refund_id,
    paymentId: refund.payment_id,
    amount: refund.amount ?? 0,
    isPartial: refund.is_partial,
  });
  if (!found) throw new Error(`refund ${refund.refund_id} for unknown payment ${refund.payment_id}`);
}

async function clawbackFromDispute(db: Db, dispute: DodoPayments.Dispute): Promise<void> {
  const { found } = await clawbackRefund(db, {
    refundId: `dispute:${dispute.dispute_id}`,
    paymentId: dispute.payment_id,
    amount: 0,
    isPartial: false,
  });
  if (!found) throw new Error(`dispute ${dispute.dispute_id} for unknown payment ${dispute.payment_id}`);
}
