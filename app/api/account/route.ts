import { features } from "@/lib/config";
import { creditCost, DAILY_LIMITS, PACKS } from "@/lib/domain/pricing";
import { loadProfile, requireUserId } from "@/lib/server/auth";
import {
  countRunsToday,
  ensureAccount,
  getAccountSummary,
  hasWelcome,
  refundStaleRuns,
} from "@/lib/server/billing/ledger";
import { getDb, type Db } from "@/lib/server/db";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const flags = features();
  const db = flags.db ? getDb() : null;
  const userId = db ? await requireUserId() : null;
  if (!db || !userId || userId instanceof Response) {
    return Response.json({ signedIn: false, features: flags }, { headers: NO_STORE });
  }

  if (!(await hasWelcome(db, userId))) {
    const profile = await loadProfile();
    if (!profile) return Response.json({ signedIn: false, features: flags }, { headers: NO_STORE });
    await ensureAccount(db, userId, { verifiedEmail: profile.verifiedEmail });
  }
  await refundStaleRuns(db, userId);

  const paymentId = new URL(req.url).searchParams.get("paymentId");
  const [{ balance, hasPurchased }, gradeUsed, credited] = await Promise.all([
    getAccountSummary(db, userId),
    countRunsToday(db, userId, "grade"),
    paymentId ? paymentCredited(db, userId, paymentId) : null,
  ]);

  return Response.json(
    {
      signedIn: true,
      features: flags,
      balance,
      hasPurchased,
      quotas: { grade: { used: gradeUsed, limit: DAILY_LIMITS.grade[hasPurchased ? "purchaser" : "free"] } },
      costs: {
        intakeText: creditCost("intake", { source: "description" }),
        intakeRepo: creditCost("intake", { source: "repository" }),
        review: creditCost("review"),
        questions: creditCost("questions"),
        grade: creditCost("grade"),
      },
      packs: PACKS,
      payment: credited === null ? undefined : { credited },
    },
    { headers: NO_STORE },
  );
}

/** True once the webhook has granted this payment, so the checkout return page can stop waiting. */
async function paymentCredited(db: Db, userId: string, paymentId: string): Promise<boolean> {
  const [row] = await db.query<{ credited: boolean }>(
    "select exists(select 1 from payments where payment_id = $1::text and user_id = $2::text) as credited",
    [paymentId, userId],
  );
  return row?.credited ?? false;
}
