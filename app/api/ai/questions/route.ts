import { AI_ERROR_MESSAGES, type AiErrorCode } from "@/lib/ai/errors";
import type { AiEvent } from "@/lib/ai/events";
import { QuestionsRequestSchema, type QuestionsRequest } from "@/lib/ai/requests";
import { TailoredQuestionSetSchema } from "@/lib/ai/schemas";
import { features } from "@/lib/config";
import { normalizeQuestions } from "@/lib/domain/ai-questions";
import type { Project } from "@/lib/domain/learner";
import { modelHash } from "@/lib/domain/model-hash";
import { projectQuestions } from "@/lib/domain/project-questions";
import { creditCost } from "@/lib/domain/pricing";
import { generateStructured } from "@/lib/server/ai/generate";
import { runMetered } from "@/lib/server/ai/metered";
import { ndjsonResponse, runFailureEvent } from "@/lib/server/ai/ndjson";
import { buildQuestionsPrompt } from "@/lib/server/ai/prompts/questions";
import { requireUser } from "@/lib/server/auth";
import { ensureAccount } from "@/lib/server/billing/ledger";
import { catalogText, conceptCatalog } from "@/lib/server/concept-catalog";
import { getDb } from "@/lib/server/db";

export const maxDuration = 300;

function failure(code: AiErrorCode, status: number): Response {
  const event: AiEvent = { type: "error", code, message: AI_ERROR_MESSAGES[code], refunded: false };
  return Response.json(event, { status, headers: { "Cache-Control": "no-store" } });
}

function projectFromInput(input: QuestionsRequest, now: string): Project {
  return {
    id: input.projectId,
    name: input.name,
    summary: input.summary,
    context: input.context,
    source: { type: "manual" },
    components: input.model.components,
    flows: input.model.flows,
    invariants: input.model.invariants,
    createdAt: now,
    updatedAt: now,
  };
}

export async function POST(request: Request) {
  const db = features().ai ? getDb() : null;
  if (!db) return failure("ai_unavailable", 503);

  const user = await requireUser();
  if (user instanceof Response) return user;

  const parsed = QuestionsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("input_invalid", 400);
  const input = parsed.data;

  return ndjsonResponse(async (emit) => {
    await ensureAccount(db, user.userId, { verifiedEmail: user.verifiedEmail });

    const project = projectFromInput(input, new Date().toISOString());
    const { instructions, prompt } = buildQuestionsPrompt({
      name: input.name,
      summary: input.summary,
      context: input.context,
      model: input.model,
      reviewFindingTitles: input.reviewFindingTitles,
      templateTitles: projectQuestions(project).map((question) => question.title),
      catalog: catalogText(),
    });
    const knownConcepts = new Set(conceptCatalog().map((concept) => concept.id));

    const result = await runMetered({
      db,
      userId: user.userId,
      feature: "questions",
      credits: creditCost("questions"),
      projectId: input.projectId,
      title: input.name,
      modelHash: modelHash(input.model),
      worstCase: { tier: "strong", inputChars: instructions.length + prompt.length, maxOutputTokens: 8000 },
      emit,
      execute: async ({ runId, signal }) => {
        emit({ type: "progress", step: "writing", runId });
        const generated = await generateStructured({
          feature: "questions",
          tier: "strong",
          userId: user.userId,
          instructions,
          prompt,
          schema: TailoredQuestionSetSchema,
          maxOutputTokens: 8000,
          signal,
        });
        return {
          output: normalizeQuestions(generated.output, input.model, knownConcepts, new Date().toISOString(), runId),
          model: generated.model,
          inputTokens: generated.inputTokens,
          outputTokens: generated.outputTokens,
          costUsd: generated.costUsd,
        };
      },
    });

    if (result.ok) {
      emit({ type: "result", runId: result.runId, data: { questions: result.output } });
    } else {
      emit(runFailureEvent(result));
    }
  });
}
