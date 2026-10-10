import { z } from "zod";
import { features } from "@/lib/config";
import { requireUser } from "@/lib/server/auth";
import { listRuns } from "@/lib/server/billing/ledger";
import { getDb } from "@/lib/server/db";

const NO_STORE = { "Cache-Control": "no-store" };

const ListQuery = z.object({
  projectId: z.string().min(1).max(200).optional(),
  feature: z.enum(["intake", "review", "questions", "grade", "interview"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: Request) {
  const db = features().ai ? getDb() : null;
  if (!db) return Response.json({ type: "error", code: "ai_unavailable" }, { status: 503, headers: NO_STORE });

  const user = await requireUser();
  if (user instanceof Response) {
    user.headers.set("Cache-Control", "no-store");
    return user;
  }

  const params = new URL(req.url).searchParams;
  const parsed = ListQuery.safeParse({
    projectId: params.get("projectId") ?? undefined,
    feature: params.get("feature") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ type: "error", code: "input_invalid" }, { status: 400, headers: NO_STORE });
  }

  const runs = await listRuns(db, user.userId, parsed.data);
  return Response.json({ runs }, { headers: NO_STORE });
}
