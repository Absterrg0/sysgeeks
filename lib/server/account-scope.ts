import "server-only";
import { redirect } from "next/navigation";
import { features } from "@/lib/config";
import { loadProfile, requireUserId } from "@/lib/server/auth";
import { ensureAccount, refundStaleRuns } from "@/lib/server/billing/ledger";
import { getDb, type Db } from "@/lib/server/db";

export type AccountScope = { db: Db; userId: string };

/**
 * Opens the signed-in visitor's account for a server-rendered account page.
 * Signed-out visitors go to sign-in and return to `returnTo`. A deployment without auth or a database returns a reason instead, so the page can say so.
 */
export async function openAccount(returnTo = "/account"): Promise<AccountScope | "auth-off" | "db-off"> {
  if (!features().auth) return "auth-off";
  const db = getDb();
  if (!db) return "db-off";

  const userId = await requireUserId();
  if (userId instanceof Response) redirect(`/sign-in?redirect_url=${returnTo}`);
  const profile = await loadProfile();
  if (!profile) redirect(`/sign-in?redirect_url=${returnTo}`);

  await ensureAccount(db, userId, { verifiedEmail: profile.verifiedEmail });
  await refundStaleRuns(db, userId);
  return { db, userId };
}
