"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreditCost } from "@/components/account/credit-cost";
import { InsufficientCredits } from "@/components/account/insufficient-credits";
import { SignInGate } from "@/components/account/sign-in-gate";
import { AiError } from "@/components/ai-run/ai-error";
import { FlagRun, type FlagOutcome } from "@/components/ai-run/flag-run";
import { ProgressSteps, type ProgressStep } from "@/components/ai-run/progress-steps";
import { Callout } from "@/components/feedback";
import type { ConceptResolver } from "@/components/prose-core";
import { AiFailure, type AiErrorCode } from "@/lib/ai/errors";
import type { Review } from "@/lib/ai/schemas";
import { useAccount } from "@/lib/client/account";
import { runAi } from "@/lib/client/ai";
import type { Project } from "@/lib/domain/learner";
import { uniqueSlug } from "@/lib/domain/layout";
import { modelHash } from "@/lib/domain/model-hash";
import { creditCost } from "@/lib/domain/pricing";
import { modelOf } from "@/lib/domain/project-model";
import { saveProject } from "@/lib/store/learner-store";
import { ModelCheck } from "./model-check";
import { ReportView } from "./report-view";

type ReviewOutput = { review: Review; modelHash: string; model: string };
type SuggestedInvariant = Review["suggestedInvariants"][number];

export type Report = {
  runId: string;
  createdAt: string;
  modelHash: string | null;
  review: Review;
  flagged: boolean;
};

type RunRow = { id: string; status: string; flagged: boolean; createdAt: string; modelHash: string | null };

/** The free model check, then the AI review for signed-in users. */
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
      <SignInGate>
        <AiReview project={project} resolve={resolve} onHighlight={onHighlight} />
      </SignInGate>
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
  const account = useAccount();
  const balance = account.data?.signedIn ? account.data.balance : null;
  const [report, setReport] = useState<Report | null>(null);
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<{ code: AiErrorCode; refunded: boolean } | null>(null);
  const [paywallHidden, setPaywallHidden] = useState(false);

  const cost = creditCost("review");
  const hasComponents = project.components.length > 0;
  const short = balance !== null && balance < cost;
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
    setRunning(true);
    setSteps([]);
    setFailure(null);
    const result: { runId?: string } = {};
    try {
      const data = await runAi<ReviewOutput>(
        "/api/ai/review",
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
      );
      if (result.runId) {
        setReport({
          runId: result.runId,
          createdAt: new Date().toISOString(),
          modelHash: data.modelHash,
          review: data.review,
          flagged: false,
        });
      }
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

  async function flag(reason: string): Promise<FlagOutcome> {
    if (!report) throw new Error("No report to flag.");
    const res = await fetch(`/api/ai/runs/${report.runId}/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.status === 409 || res.status === 429) return { refunded: false };
    if (!res.ok) throw new Error("Flag failed.");
    const { refunded } = (await res.json()) as { refunded: number };
    account.refresh();
    return refunded > 0 ? { refunded: true, credits: refunded } : { refunded: false };
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
        <button
          type="button"
          className="btn btn-primary"
          disabled={running || !hasComponents || short}
          onClick={run}
        >
          {running ? "Running…" : "Run AI review"}
        </button>
        <CreditCost credits={cost} balance={balance ?? undefined} />
      </div>
      {!hasComponents && <p className="text-small text-ink-3">Add at least one component to the model first.</p>}
      {short && !paywallHidden && balance !== null && (
        <InsufficientCredits
          feature="Architecture review"
          cost={cost}
          balance={balance}
          onDismiss={() => setPaywallHidden(true)}
        />
      )}
      {running && <ProgressSteps steps={steps} />}
      {failure && <AiError code={failure.code} refunded={failure.refunded} onRetry={run} />}

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
            {report.flagged ? (
              <p className="text-small text-ink-2">You flagged this review. Its credits were refunded.</p>
            ) : (
              <FlagRun onFlag={flag} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** The newest successful review of this project, with its output. */
export async function loadLatestReport(projectId: string): Promise<Report | null> {
  const list = await getJson<{ runs: RunRow[] }>(
    `/api/ai/runs?projectId=${encodeURIComponent(projectId)}&feature=review&limit=10`,
  );
  const latest = list?.runs.find((run) => run.status === "succeeded");
  if (!latest) return null;

  const detail = await getJson<{ run: { output: unknown } }>(`/api/ai/runs/${latest.id}`);
  const output = detail?.run.output;
  if (typeof output !== "object" || output === null || !("review" in output)) return null;

  return {
    runId: latest.id,
    createdAt: latest.createdAt,
    modelHash: latest.modelHash,
    review: (output as ReviewOutput).review,
    flagged: latest.flagged,
  };
}

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(path, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json().catch(() => null)) as T | null) ?? null;
}
