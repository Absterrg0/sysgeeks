import type { DodoPayments } from "dodopayments";
import { getDodo, handleDodoEvent } from "@/lib/server/billing/dodo";
import { getDb } from "@/lib/server/db";

export async function POST(req: Request) {
  const body = await req.text();
  const dodo = getDodo();
  const db = getDb();
  if (!dodo || !db) return Response.json({ type: "error", code: "ai_unavailable" }, { status: 503 });

  let event: DodoPayments.UnwrapWebhookEvent;
  try {
    event = dodo.webhooks.unwrap(body, { headers: Object.fromEntries(req.headers) });
  } catch {
    return Response.json({ type: "error", code: "invalid_signature" }, { status: 401 });
  }

  try {
    await handleDodoEvent(db, event);
  } catch (error) {
    console.error("dodo webhook failed", event.type, error);
    return Response.json({ type: "error", code: "webhook_failed" }, { status: 500 });
  }
  return Response.json({ received: true });
}
