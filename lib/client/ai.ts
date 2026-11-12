/**
 * AI features, run in the learner's browser with their own key. A thin front: the AI SDK, the prompts and the
 * provider packages load only when a run starts, so pages that merely offer AI stay light.
 */
import type { AiEvent } from "@/lib/ai/events";
import type { GradeSubject } from "@/lib/ai/prompts/grade";
import type { GradeResponseKind } from "@/lib/ai/requests";
import type { AiAssessment, AiRunFeature } from "@/lib/domain/learner";

export type { ReviewOutput } from "./ai-runners";

/**
 * Runs an AI feature with the learner's key. `onEvent` sees progress as it happens and the result at the end.
 * Resolves with the result data, or rejects with an AiFailure carrying the error code.
 * `/api/ai/<feature>` is accepted for callers written when these were server routes.
 */
export async function runAi<T = unknown>(
  feature: AiRunFeature | `/api/ai/${AiRunFeature}`,
  body: unknown,
  onEvent?: (event: AiEvent) => void,
  signal?: AbortSignal,
): Promise<T> {
  const { runAiNow } = await import("./ai-runners");
  return runAiNow<T>(feature, body, onEvent, signal);
}

/** Marks a written answer against its rubric with the learner's key. */
export async function gradeAnswer(
  subject: GradeSubject,
  responseKind: GradeResponseKind,
  text: string,
  signal?: AbortSignal,
): Promise<AiAssessment> {
  const { gradeAnswerNow } = await import("./ai-runners");
  return gradeAnswerNow(subject, responseKind, text, signal);
}
