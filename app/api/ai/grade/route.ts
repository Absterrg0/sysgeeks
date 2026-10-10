import { z } from "zod";
import { AI_ERROR_MESSAGES, type AiErrorCode } from "@/lib/ai/errors";
import { GradeRequestSchema } from "@/lib/ai/requests";
import { GradeSchema, TailoredQuestionSchema } from "@/lib/ai/schemas";
import { features } from "@/lib/config";
import { toAiAssessment } from "@/lib/domain/ai-grade";
import type { TailoredQuestion } from "@/lib/domain/learner";
import { splitPassages } from "@/lib/domain/passages";
import { generateStructured } from "@/lib/server/ai/generate";
import { runMetered } from "@/lib/server/ai/metered";
import { GRADE_INSTRUCTIONS, gradePrompt, resolveGradeTarget } from "@/lib/server/ai/prompts/grade";
import { requireUser } from "@/lib/server/auth";
import { ensureAccount, getRun } from "@/lib/server/billing/ledger";
import { type Db, getDb } from "@/lib/server/db";

export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

const STATUS: Partial<Record<AiErrorCode, number>> = {
  auth_required: 401,
  input_invalid: 400,
  insufficient_credits: 402,
  rate_limited: 429,
  too_many_running: 429,
  ai_unavailable: 503,
  budget_exhausted: 503,
  model_failed: 502,
  invalid_output: 502,
  timeout: 504,
};

/** A question as the questions run stored it. */
const StoredTailoredSchema = TailoredQuestionSchema.extend({
  generatedAt: z.string(),
  runId: z.string(),
});

function failure(code: AiErrorCode): Response {
  return Response.json(
    { ok: false, code, message: AI_ERROR_MESSAGES[code] },
    { status: STATUS[code] ?? 500, headers: NO_STORE },
  );
}

async function storedTailored(
  db: Db,
  userId: string,
  runId: string,
  projectId: string,
  questionId: string,
): Promise<TailoredQuestion | null> {
  const run = await getRun(db, userId, runId);
  if (!run || run.feature !== "questions" || run.projectId !== projectId) return null;
  if (run.status !== "succeeded" || run.output == null) return null;
  const outputs = z.array(z.looseObject({ id: z.string() })).safeParse(run.output);
  const match = outputs.success ? outputs.data.find((question) => question.id === questionId) : undefined;
  const parsed = StoredTailoredSchema.safeParse(match);
  return parsed.success ? parsed.data : null;
}

export async function POST(req: Request) {
  if (!features().ai) return failure("ai_unavailable");
  const db = getDb();
  if (!db) return failure("ai_unavailable");

  const user = await requireUser();
  if (user instanceof Response) return failure(user.status === 503 ? "ai_unavailable" : "auth_required");
  await ensureAccount(db, user.userId, { verifiedEmail: user.verifiedEmail });

  const parsed = GradeRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return failure("input_invalid");
  const request = parsed.data;
  const target = await resolveGradeTarget(request, {
    lookupTailored: (runId, projectId, questionId) => storedTailored(db, user.userId, runId, projectId, questionId),
  });
  if (!target) return failure("input_invalid");

  const passages = splitPassages(request.text, request.responseKind === "implementation" ? "code" : "prose");
  const prompt = gradePrompt(target, passages);
  const result = await runMetered({
    db,
    userId: user.userId,
    feature: "grade",
    credits: 0,
    title: target.title,
    worstCase: { tier: "fast", inputChars: GRADE_INSTRUCTIONS.length + prompt.length, maxOutputTokens: 2000 },
    execute: async ({ runId, signal }) => {
      const grade = await generateStructured({
        feature: "grade",
        tier: "fast",
        userId: user.userId,
        instructions: GRADE_INSTRUCTIONS,
        prompt,
        schema: GradeSchema,
        maxOutputTokens: 2000,
        timeoutMs: 30_000,
        signal,
      });
      const assessment = toAiAssessment(grade.output, target.rubric, passages, {
        runId,
        model: grade.model,
        now: new Date().toISOString(),
      });
      return {
        output: assessment,
        model: grade.model,
        inputTokens: grade.inputTokens,
        outputTokens: grade.outputTokens,
        costUsd: grade.costUsd,
      };
    },
  });
  if (!result.ok) return failure(result.code);
  return Response.json({ ok: true, assessment: result.output }, { headers: NO_STORE });
}
