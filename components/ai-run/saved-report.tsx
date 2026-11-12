"use client";

import Link from "next/link";
import { Callout, Skeleton } from "@/components/feedback";
import type { ConceptResolver } from "@/components/prose-core";
import { ReportView } from "@/components/projects/review/report-view";
import { readStoredReview } from "@/lib/domain/ai-review";
import { useLearnerState } from "@/lib/store/learner-store";

/** A review saved in this browser, opened from its run id. Reports never leave the browser that ran them. */
export function SavedReport({ runId, concepts }: { runId: string; concepts: Record<string, { title: string; summary: string }> }) {
  const state = useLearnerState();
  const resolve: ConceptResolver = (id) => concepts[id];
  if (!state) return <Skeleton lines={6} />;

  const run = state.aiRuns.find((r) => r.id === runId && r.feature === "review");
  const review = run ? readStoredReview((run.output as { review?: unknown }).review) : null;
  if (!run || !review) {
    return (
      <Callout tone="failure" title="This report isn't in this browser">
        <p>
          Reports are kept in the browser that ran them, and only the last 30 AI runs are kept. Open it in that
          browser, or import your progress there and here.{" "}
          <Link href="/review#standing" className="link">
            Your data
          </Link>
        </p>
      </Callout>
    );
  }

  const project = state.projects.find((p) => p.id === run.projectId);
  const labels = project ? Object.fromEntries(project.components.map((c) => [c.id, c.label])) : undefined;
  return (
    <div>
      <h1 className="font-display text-[1.625rem] leading-[1.15] tracking-[-0.02em] text-balance">
        {run.title ?? "Architecture review"}
      </h1>
      <p className="mt-1.5 text-small text-ink-3">
        {run.model} · saved in this browser
        {project && (
          <>
            {" · "}
            <Link href={`/projects/${project.id}`} className="link">
              Back to {project.name}
            </Link>
          </>
        )}
      </p>
      <div className="mt-6">
        <ReportView review={review} resolve={resolve} createdAt={run.createdAt} componentLabels={labels} />
      </div>
    </div>
  );
}
