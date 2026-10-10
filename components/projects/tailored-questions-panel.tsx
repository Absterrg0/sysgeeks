"use client";

import { type RefObject, useState } from "react";
import { CreditCost } from "@/components/account/credit-cost";
import { InsufficientCredits } from "@/components/account/insufficient-credits";
import { SignInGate } from "@/components/account/sign-in-gate";
import { AiBlock } from "@/components/ai";
import { AiError } from "@/components/ai-run/ai-error";
import { ProgressSteps, type ProgressStep } from "@/components/ai-run/progress-steps";
import { AiFailure, type AiErrorCode } from "@/lib/ai/errors";
import { useAccount } from "@/lib/client/account";
import { runAi } from "@/lib/client/ai";
import type { ExerciseRef, LearnerState, Project, TailoredQuestion } from "@/lib/domain/learner";
import { modelOf } from "@/lib/domain/project-model";
import { answeredTailored, regenerateTailored } from "@/lib/domain/project-questions";
import { creditCost } from "@/lib/domain/pricing";
import { saveProject } from "@/lib/store/learner-store";

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
    <SignInGate>
      <Generator project={project} attempts={attempts} storeState={storeState} />
    </SignInGate>
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
  const account = useAccount();
  const balance = account.data?.signedIn ? account.data.balance : null;
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<{ code: AiErrorCode; refunded: boolean } | null>(null);
  const [paywallHidden, setPaywallHidden] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  const cost = creditCost("questions");
  const hasComponents = project.components.length > 0;
  const short = balance !== null && balance < cost;
  const tailored = project.tailoredQuestions ?? [];
  const answered = answeredTailored(project, attempts).length;
  const unanswered = tailored.length - answered;

  async function generate() {
    setRunning(true);
    setSteps([]);
    setFailure(null);
    setAdded(null);
    try {
      const findings = await latestFindingTitles(project.id);
      const data = await runAi<{ questions: TailoredQuestion[] }>(
        "/api/ai/questions",
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
      setFailure(
        error instanceof AiFailure
          ? { code: error.code, refunded: error.refunded }
          : { code: "ai_unavailable", refunded: false },
      );
    } finally {
      setRunning(false);
      account.refresh();
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
            disabled={running || !hasComponents || short}
            onClick={generate}
          >
            {running ? "Writing…" : tailored.length === 0 ? "Generate questions" : "Regenerate questions"}
          </button>
          <CreditCost credits={cost} balance={balance ?? undefined} />
        </div>
        {!hasComponents && <p className="text-small text-ink-3">Add at least one component to the model first.</p>}
        {unanswered > 0 && !running && (
          <p className="text-small text-ink-3">Regenerating replaces the {unanswered} you have not answered.</p>
        )}
        {short && !paywallHidden && balance !== null && (
          <InsufficientCredits
            feature="Tailored questions"
            cost={cost}
            balance={balance}
            onDismiss={() => setPaywallHidden(true)}
          />
        )}
        {running && <ProgressSteps steps={steps} />}
        {failure && <AiError code={failure.code} refunded={failure.refunded} onRetry={generate} />}
        {added !== null && (
          <p role="status" className="text-small text-ink-2">
            Added {added} questions to the groups below.
          </p>
        )}
      </div>
    </AiBlock>
  );
}

/** Finding titles from the newest successful review. Empty when there is none or it cannot be read. */
async function latestFindingTitles(projectId: string): Promise<string[]> {
  const list = await getJson<{ runs: { id: string; status: string }[] }>(
    `/api/ai/runs?projectId=${encodeURIComponent(projectId)}&feature=review&limit=10`,
  );
  const latest = list?.runs.find((run) => run.status === "succeeded");
  if (!latest) return [];
  const detail = await getJson<{ run: { output?: { review?: { findings?: { title: string }[] } } | null } }>(
    `/api/ai/runs/${latest.id}`,
  );
  return detail?.run.output?.review?.findings?.map((finding) => finding.title).slice(0, MAX_FINDINGS) ?? [];
}

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(path, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}
