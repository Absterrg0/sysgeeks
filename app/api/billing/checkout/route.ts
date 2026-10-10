import { z } from "zod";
import { packById } from "@/lib/domain/pricing";
import { getDodo, productForPack } from "@/lib/server/billing/dodo";
import { recordCheckout } from "@/lib/server/billing/ledger";
import { loadProfile, requireUserId } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { SITE_URL } from "@/lib/site";

const CheckoutRequest = z.object({ packId: z.string() });

export async function POST(req: Request) {
  const dodo = getDodo();
  const db = getDb();
  if (!dodo || !db) return Response.json({ type: "error", code: "ai_unavailable" }, { status: 503 });

  const userId = await requireUserId();
  if (userId instanceof Response) return userId;

  const parsed = CheckoutRequest.safeParse(await req.json().catch(() => null));
  const pack = parsed.success ? packById(parsed.data.packId) : undefined;
  if (!pack) return Response.json({ type: "error", code: "invalid_pack" }, { status: 400 });
  const productId = productForPack(pack.id);
  if (!productId) return Response.json({ type: "error", code: "ai_unavailable" }, { status: 503 });

  const profile = await loadProfile();
  if (!profile) return Response.json({ type: "error", code: "auth_required" }, { status: 401 });

  const session = await dodo.checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: profile.email ? { email: profile.email, name: profile.name } : undefined,
    return_url: `${SITE_URL}/account/billing/success`,
    cancel_url: `${SITE_URL}/?canceled=1#pricing`,
    metadata: { userId, packId: pack.id },
    feature_flags: { allow_discount_code: true },
  });
  if (!session.checkout_url) return Response.json({ type: "error", code: "checkout_failed" }, { status: 502 });

  await recordCheckout(db, { sessionId: session.session_id, userId, packId: pack.id });
  return Response.json({ checkoutUrl: session.checkout_url });
}
