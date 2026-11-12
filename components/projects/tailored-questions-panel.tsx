"use client";

import { type RefObject, useState } from "react";
import { AiBlock } from "@/components/ai";
import { AiKeyGate, AiModelTag } from "@/components/ai-key/ai-key-gate";
import { AiError } from "@/components/ai-run/ai-error";
import { ProgressSteps, type ProgressStep } from "@/components/ai-run/progress-steps";
import { AiFailure, type AiErrorCode } from "@/lib/ai/errors";
import { runAi } from "@/lib/client/ai";
import type { ExerciseRef, LearnerState, Project, TailoredQuestion } from "@/lib/domain/learner";
import { modelOf } from "@/lib/domain/project-model";
import { answeredTailored, regenerateTailored } from "@/lib/domain/project-questions";
import { saveProject } from "@/lib/store/learner-store";
import { latestReport } from "./review/review-tab";

/** The most review findings sent with a request, matching the route's limit. */
const MAX_FINDINGS = 12;

/**
 * Writes questions about this project's own design. `storeState` is the store's
 * current state, read when the run ends, so edits made during the run are kept.
 */
export function TailoredQuestionsPanel({
  project,
  attempts,
  storeState,
}: {
  project: Project;
  attempts: readonly { exercise: ExerciseRef }[];
  storeState: RefObject<LearnerState | null>;
}) {
  return (
    <AiKeyGate>
      <Generator project={project} attempts={attempts} storeState={storeState} />
    </AiKeyGate>
  );
}

function Generator({
  project,
  attempts,
  storeState,
}: {
  project: Project;
  attempts: readonly { exercise: ExerciseRef }[];
  storeState: RefObject<LearnerState | null>;
}) {
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [running, setRunning] = useState<AbortController | null>(null);
  const [failure, setFailure] = useState<{ code: AiErrorCode; detail?: string } | null>(null);
  const [added, setAdded] = useState<number | null>(null);

  const hasComponents = project.components.length > 0;
  const tailored = project.tailoredQuestions ?? [];
  const answered = answeredTailored(project, attempts).length;
  const unanswered = tailored.length - answered;

  async function generate() {
    const controller = new AbortController();
    setRunning(controller);
    setSteps([]);
    setFailure(null);
    setAdded(null);
    try {
      const findings = latestFindingTitles(project.id);
      const data = await runAi<{ questions: TailoredQuestion[] }>(
        "questions",
        {
          projectId: project.id,
          name: project.name,
          summary: project.summary,
          context: project.context,
          model: modelOf(project),
          reviewFindingTitles: findings.length > 0 ? findings : undefined,
        },
        (event) => {
          if (event.type === "progress") setSteps((prev) => [...prev, event]);
        },
        controller.signal,
      );
      const fresh = storeState.current;
      const current = fresh?.projects.find((p) => p.id === project.id);
      if (!current) return;
      saveProject({
        ...current,
        tailoredQuestions: regenerateTailored(current, fresh?.attempts ?? [], data.questions),
        updatedAt: new Date().toISOString(),
      });
      setAdded(data.questions.length);
    } catch (error) {
      setFailure(error instanceof AiFailure ? { code: error.code, detail: error.detail } : { code: "ai_unavailable" });
    } finally {
      setRunning(null);
    }
  }

  const provenance =
    tailored.length === 0
      ? "Reads your model, scale and latest review. Nothing written yet."
      : `${tailored.length} written for this model · ${answered} answered`;

  return (
    <AiBlock kind="suggestion" provenance={provenance}>
      <div className="grid gap-4">
        <p className="text-ui text-ink-2">
          Questions about your design that the general templates cannot ask: its trade-offs, its tech choices and its
          trickiest flow.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={running !== null || !hasComponents}
            onClick={generate}
          >
            {running ? "Writing…" : tailored.length === 0 ? "Generate questions" : "Regenerate questions"}
          </button>
          <AiModelTag />
        </div>
        {!hasComponents && <p className="text-small text-ink-3">Add at least one component to the model first.</p>}
        {unanswered > 0 && !running && (
          <p className="text-small text-ink-3">Regenerating replaces the {unanswered} you have not answered.</p>
        )}
        {running && <ProgressSteps steps={steps} onStop={() => running.abort()} />}
        {failure && <AiError code={failure.code} detail={failure.detail} onRetry={generate} />}
        {added !== null && (
          <p role="status" className="text-small text-ink-2">
            Added {added} questions to the groups below.
          </p>
        )}
      </div>
    </AiBlock>
  );
}

/** Finding titles from the newest review saved in this browser. Empty when there is none. */
function latestFindingTitles(projectId: string): string[] {
  return latestReport(projectId)?.review.findings.map((finding) => finding.title).slice(0, MAX_FINDINGS) ?? [];
}
