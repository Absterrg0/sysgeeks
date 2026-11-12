"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AiKeyGate, AiModelTag } from "@/components/ai-key/ai-key-gate";
import { AiError } from "@/components/ai-run/ai-error";
import { ProgressSteps, type ProgressStep } from "@/components/ai-run/progress-steps";
import { Callout } from "@/components/feedback";
import type { ConceptResolver } from "@/components/prose-core";
import { AiFailure, type AiErrorCode } from "@/lib/ai/errors";
import type { Review } from "@/lib/ai/schemas";
import { runAi, type ReviewOutput } from "@/lib/client/ai";
import type { Project } from "@/lib/domain/learner";
import { uniqueSlug } from "@/lib/domain/layout";
import { readStoredReview } from "@/lib/domain/ai-review";
import { modelHash } from "@/lib/domain/model-hash";
import { modelOf } from "@/lib/domain/project-model";
import { readAiRuns, saveProject } from "@/lib/store/learner-store";
import { ModelCheck } from "./model-check";
import { ReportView } from "./report-view";

type SuggestedInvariant = Review["suggestedInvariants"][number];

export type Report = {
  runId: string;
  createdAt: string;
  modelHash: string | null;
  review: Review;
  /** The model that wrote it. */
  model?: string;
  /** @deprecated Flagging refunded credits; there are none now. Ignored. */
  flagged?: boolean;
};

/** The free model check, then the AI review on the learner's own key. */
export function ReviewTab({
  project,
  resolve,
  onHighlight,
}: {
  project: Project;
  resolve: ConceptResolver;
  onHighlight: (componentIds: string[]) => void;
}) {
  return (
    <div className="grid gap-10">
      <ModelCheck model={modelOf(project)} resolve={resolve} onHighlight={onHighlight} />
      <AiKeyGate>
        <AiReview project={project} resolve={resolve} onHighlight={onHighlight} />
      </AiKeyGate>
    </div>
  );
}

function AiReview({
  project,
  resolve,
  onHighlight,
}: {
  project: Project;
  resolve: ConceptResolver;
  onHighlight: (componentIds: string[]) => void;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [running, setRunning] = useState<AbortController | null>(null);
  const [failure, setFailure] = useState<{ code: AiErrorCode; detail?: string } | null>(null);

  const hasComponents = project.components.length > 0;
  const currentHash = modelHash(modelOf(project));
  const stale = report !== null && report.modelHash !== currentHash;
  const labels = Object.fromEntries(project.components.map((c) => [c.id, c.label]));

  useEffect(() => {
    let cancelled = false;
    loadLatestReport(project.id).then((next) => {
      if (!cancelled && next) setReport(next);
    });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  async function run() {
    const controller = new AbortController();
    setRunning(controller);
    setSteps([]);
    setFailure(null);
    const result: { runId?: string } = {};
    try {
      const data = await runAi<ReviewOutput>(
        "review",
        {
          projectId: project.id,
          name: project.name,
          summary: project.summary,
          context: project.context,
          model: modelOf(project),
        },
        (event) => {
          if (event.type === "progress") setSteps((prev) => [...prev, event]);
          if (event.type === "result") result.runId = event.runId;
        },
        controller.signal,
      );
      if (result.runId) {
        setReport({
          runId: result.runId,
          createdAt: new Date().toISOString(),
          modelHash: data.modelHash,
          review: data.review,
          model: data.model,
        });
      }
    } catch (error) {
      setFailure(error instanceof AiFailure ? { code: error.code, detail: error.detail } : { code: "ai_unavailable" });
    } finally {
      setRunning(null);
    }
  }

  function addInvariant(suggestion: SuggestedInvariant) {
    const components = new Set(project.components.map((c) => c.id));
    saveProject({
      ...project,
      invariants: [
        ...project.invariants,
        {
          id: uniqueSlug(suggestion.statement, project.invariants.map((i) => i.id)),
          statement: suggestion.statement,
          enforcedBy: suggestion.enforcedBy.filter((id) => components.has(id)),
          mechanism: suggestion.mechanism,
        },
      ],
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <section aria-label="AI review" className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={running !== null || !hasComponents} onClick={run}>
          {running ? "Running…" : report ? "Run the review again" : "Run AI review"}
        </button>
        <AiModelTag />
      </div>
      {!hasComponents && <p className="text-small text-ink-3">Add at least one component to the model first.</p>}
      {running && <ProgressSteps steps={steps} onStop={() => running.abort()} />}
      {failure && <AiError code={failure.code} detail={failure.detail} onRetry={run} />}

      {report && (
        <div className="grid gap-5">
          {stale && (
            <Callout tone="change" title="Model changed since this review">
              Run the review again to check the model as it is now.
            </Callout>
          )}
          <ReportView
            review={report.review}
            resolve={resolve}
            createdAt={report.createdAt}
            componentLabels={labels}
            onHighlight={onHighlight}
            onAddInvariant={addInvariant}
            addedStatements={project.invariants.map((i) => i.statement)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule-soft pt-4">
            <Link href={`/reports/${report.runId}`} className="link text-small">
              Open full report
            </Link>
            <p className="text-small text-ink-3">Saved in this browser{report.model ? ` · ${report.model}` : ""}</p>
          </div>
        </div>
      )}
    </section>
  );
}

/** The newest review of this project saved in this browser. Async for callers written when it was fetched. */
export async function loadLatestReport(projectId: string): Promise<Report | null> {
  return latestReport(projectId);
}

export function latestReport(projectId: string): Report | null {
  const run = readAiRuns().findLast((r) => r.feature === "review" && r.projectId === projectId);
  const output = run?.output as Partial<ReviewOutput> | undefined;
  const review = readStoredReview(output?.review);
  if (!run || !review) return null;
  return { runId: run.id, createdAt: run.createdAt, modelHash: run.modelHash ?? null, review, model: run.model };
}
