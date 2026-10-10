import { features } from "@/lib/config";
import { AI_ERROR_MESSAGES, AiFailure } from "@/lib/ai/errors";
import { ReviewRequestSchema } from "@/lib/ai/requests";
import { ReviewSchema } from "@/lib/ai/schemas";
import { normalizeReview } from "@/lib/domain/ai-review";
import { modelHash } from "@/lib/domain/model-hash";
import { lintModel } from "@/lib/domain/model-lint";
import { creditCost } from "@/lib/domain/pricing";
import { requireUser } from "@/lib/server/auth";
import { generateStructured } from "@/lib/server/ai/generate";
import { runMetered } from "@/lib/server/ai/metered";
import { ndjsonResponse, runFailureEvent } from "@/lib/server/ai/ndjson";
import { reviewPrompt } from "@/lib/server/ai/prompts/review";
import { ensureAccount } from "@/lib/server/billing/ledger";
import { conceptCatalog } from "@/lib/server/concept-catalog";
import { getDb } from "@/lib/server/db";

export const maxDuration = 300;

export async function POST(req: Request) {
  const db = getDb();
  if (!features().ai || !db) return Response.json({ type: "error", code: "ai_unavailable" }, { status: 503 });

  const user = await requireUser();
  if (user instanceof Response) return user;

  const parsed = ReviewRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ type: "error", code: "input_invalid", message: AI_ERROR_MESSAGES.input_invalid }, { status: 400 });
  }
  const request = parsed.data;
  const { model } = request;
  const lint = lintModel(model);
  const hash = modelHash(model);
  const knownConcepts = new Set(conceptCatalog().map((concept) => concept.id));
  const { instructions, prompt } = reviewPrompt({
    name: request.name,
    summary: request.summary,
    context: request.context,
    model,
    lint,
  });

  return ndjsonResponse(async (emit) => {
    await ensureAccount(db, user.userId, { verifiedEmail: user.verifiedEmail });

    const result = await runMetered({
      db,
      userId: user.userId,
      feature: "review",
      credits: creditCost("review"),
      projectId: request.projectId,
      title: request.name,
      modelHash: hash,
      worstCase: { tier: "strong", inputChars: instructions.length + prompt.length, maxOutputTokens: 10000 },
      emit,
      execute: async ({ signal }) => {
        const served = await generateStructured({
          feature: "review",
          tier: "strong",
          userId: user.userId,
          instructions,
          prompt,
          schema: ReviewSchema,
          maxOutputTokens: 10000,
          signal,
        });
        const review = normalizeReview(served.output, model, knownConcepts);
        // A report with no findings can't be rendered later, so fail and refund instead of settling.
        if (review.findings.length === 0) throw new AiFailure("invalid_output");
        return {
          output: { review, modelHash: hash, model: served.model },
          model: served.model,
          inputTokens: served.inputTokens,
          outputTokens: served.outputTokens,
          costUsd: served.costUsd,
        };
      },
    });

    if (!result.ok) {
      emit(runFailureEvent(result));
      return;
    }
    emit({ type: "result", runId: result.runId, data: result.output });
  });
}
