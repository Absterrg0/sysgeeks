import { features } from "@/lib/config";
import { requireUser } from "@/lib/server/auth";
import { deleteRunData, getRun } from "@/lib/server/billing/ledger";
import { getDb, type Db } from "@/lib/server/db";

const NO_STORE = { "Cache-Control": "no-store" };
const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function GET(_request: Request, { params }: RouteParams) {
  const scope = await ownerScope();
  if (scope instanceof Response) return scope;

  const { runId } = await params;
  if (!RUN_ID.test(runId)) return notFound();

  const run = await getRun(scope.db, scope.userId, runId);
  if (!run) return notFound();
  return Response.json({ run }, { headers: NO_STORE });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const scope = await ownerScope();
  if (scope instanceof Response) return scope;

  const { runId } = await params;
  if (!RUN_ID.test(runId)) return notFound();

  const deleted = await deleteRunData(scope.db, scope.userId, runId);
  if (!deleted) return notFound();
  return new Response(null, { status: 204, headers: NO_STORE });
}
