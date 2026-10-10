import { getDodo } from "@/lib/server/billing/dodo";
import { getAccountSummary } from "@/lib/server/billing/ledger";
import { requireUserId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";

export async function GET() {
  const dodo = getDodo();
  const db = getDb();
  if (!dodo || !db) return Response.json({ type: "error", code: "ai_unavailable" }, { status: 503 });

  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const { dodoCustomerId } = await getAccountSummary(db, userId);
  if (!dodoCustomerId) return Response.json({ type: "error", code: "no_billing_account" }, { status: 404 });

  const session = await dodo.customers.customerPortal.create(dodoCustomerId);
  return Response.redirect(session.link, 302);
}
