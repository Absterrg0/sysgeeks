import { z } from "zod";
import { features } from "@/lib/config";
import { requireUser } from "@/lib/server/auth";
import { flagRun } from "@/lib/server/billing/ledger";
import { getDb, type Db } from "@/lib/server/db";

const NO_STORE = { "Cache-Control": "no-store" };
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FlagRequest = z.object({ reason: z.string().trim().min(1).max(1000) });

type RouteParams = { params: Promise<{ runId: string }> };

async function ownerScope(): Promise<{ db: Db; userId: string } | Response> {
  const db = features().ai ? getDb() : null;
  if (!db) return Response.json({ type: "error", code: "ai_unavailable" }, { status: 503, headers: NO_STORE });

  const user = await requireUser();
  if (user instanceof Response) {
    user.headers.set("Cache-Control", "no-store");
    return user;
  }
  return { db, userId: user.userId };
}

function notFound() {
  return Response.json({ type: "error", code: "not_found" }, { status: 404, headers: NO_STORE });
}

export async function POST(req: Request, { params }: RouteParams) {
  const scope = await ownerScope();
  if (scope instanceof Response) return scope;

  const { runId } = await params;
  if (!RUN_ID.test(runId)) return notFound();

  const parsed = FlagRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ type: "error", code: "input_invalid" }, { status: 400, headers: NO_STORE });
  }

  const result = await flagRun(scope.db, { userId: scope.userId, runId, reason: parsed.data.reason });
  if (result.ok) return Response.json({ ok: true, refunded: result.refunded }, { headers: NO_STORE });
  if (result.reason === "already-flagged") {
    return Response.json({ type: "error", code: "already_flagged" }, { status: 409, headers: NO_STORE });
  }
  if (result.reason === "limit") {
    return Response.json({ type: "error", code: "flag_limit" }, { status: 429, headers: NO_STORE });
  }
  if (result.reason === "not-eligible") {
    return Response.json({ type: "error", code: "not_eligible" }, { status: 409, headers: NO_STORE });
  }
  return notFound();
}
