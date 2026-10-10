"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { FeatureUnavailable } from "@/components/account/feature-unavailable";
import { InsufficientCredits } from "@/components/account/insufficient-credits";
import { AiError } from "@/components/ai-run/ai-error";
import { type ProgressStep, ProgressSteps } from "@/components/ai-run/progress-steps";
import { CostTag } from "@/components/billing-ui";
import { Callout, Skeleton } from "@/components/feedback";
import { DraftReview, type IntakeResult, provenanceLine } from "@/components/projects/intake/draft-review";
import { RepoFilesPreview } from "@/components/projects/intake/repo-files-preview";
import { AiFailure, type AiErrorCode } from "@/lib/ai/errors";
import { runAi } from "@/lib/client/ai";
import { useAccount } from "@/lib/client/account";
import { creditCost, type IntakeSource, WELCOME_CREDITS } from "@/lib/domain/pricing";

const MAX_DESCRIPTION_CHARS = 20_000;
const MAX_README_CHARS = 60_000;
const MAX_CONTEXT_CHARS = 2_000;

const TITLE: Record<IntakeSource, string> = {
  description: "Describe it",
  readme: "Paste a README",
  repository: "From GitHub",
};

type Phase =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "failed"; code: AiErrorCode; refunded: boolean }
  | { kind: "review"; result: IntakeResult; runId: string | null; draftedAt: string };

const creditsLabel = (n: number) => `${n} ${n === 1 ? "credit" : "credits"}`;

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The intake form for one method. Runs the draft, shows progress, then the draft review. */
export function IntakeForm({ method }: { method: IntakeSource }) {
  const { data, loading, refresh } = useAccount();
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [text, setText] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [hidePaywall, setHidePaywall] = useState(false);

  const running = phase.kind === "running";
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  if (!data) return loading ? <Skeleton lines={3} /> : <FeatureUnavailable />;
  if (!data.features.ai) return <FeatureUnavailable />;

  if (phase.kind === "review") {
    return (
      <DraftReview
        result={phase.result}
        runId={phase.runId}
        context={context.trim() || undefined}
        provenance={provenanceLine(method, phase.result.source, phase.draftedAt)}
      />
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body =
      method === "repository"
        ? { method, name: name.trim() || undefined, repoUrl: repoUrl.trim() }
        : { method, name: name.trim() || undefined, text: text.trim(), context: context.trim() || undefined };
    const seen: { runId?: string } = {};
    setSteps([]);
    setElapsed(0);
    setPhase({ kind: "running" });
    try {
      const result = await runAi<IntakeResult>("/api/ai/intake", body, (event) => {
        if (event.type === "progress") setSteps((prev) => [...prev, event]);
        if (event.type === "result") seen.runId = event.runId;
      });
      const draft = name.trim() ? { ...result.draft, name: name.trim() } : result.draft;
      setPhase({
        kind: "review",
        result: { ...result, draft },
        runId: seen.runId ?? null,
        draftedAt: new Date().toISOString(),
      });
    } catch (error) {
      const failure = error instanceof AiFailure ? error : new AiFailure("ai_unavailable");
      setPhase({ kind: "failed", code: failure.code, refunded: failure.refunded });
    } finally {
      refresh();
    }
  };

  const cost = creditCost("intake", { source: method });
  const balance = data.signedIn ? data.balance : 0;
  const canAfford = data.signedIn && balance >= cost;
  const ready = method === "repository" ? repoUrl.trim() !== "" : text.trim() !== "";
  const textLimit = method === "readme" ? MAX_README_CHARS : MAX_DESCRIPTION_CHARS;

  return (
    <div className="grid gap-5">
      {phase.kind === "failed" && (
        <AiError code={phase.code} refunded={phase.refunded} onRetry={() => setPhase({ kind: "idle" })} />
      )}

      {running ? (
        <div className="panel grid gap-4 p-5">
          <ProgressSteps steps={steps} elapsed={formatElapsed(elapsed)} />
          <RepoFilesPreview steps={steps} />
        </div>
      ) : (
        <form className="panel grid gap-5 p-5" onSubmit={submit}>
          <h2 className="font-display text-h3">{TITLE[method]}</h2>

          <div>
            <label htmlFor="intake-name" className="eyebrow mb-2 block">
              Name <span className="font-normal text-ink-3">(optional)</span>
            </label>
            <input
              id="intake-name"
              className="field"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Course marketplace backend"
            />
          </div>

          {method === "repository" ? (
            <div>
              <label htmlFor="intake-repo" className="eyebrow mb-2 block">
                Repository URL
              </label>
              <input
                id="intake-repo"
                type="url"
                className="field"
                value={repoUrl}
                maxLength={300}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                required
              />
              <p className="mt-2 text-small text-ink-3">
                Public repositories only. We read the README, the dependency manifests and the folder layout, not your
                secrets.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="intake-text" className="eyebrow mb-2 block">
                  {method === "readme" ? "README or design doc" : "What it does"}
                </label>
                <textarea
                  id="intake-text"
                  className={`field resize-y ${method === "readme" ? "field-mono" : ""}`}
                  rows={method === "readme" ? 14 : 7}
                  maxLength={textLimit}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    method === "readme"
                      ? "Paste the README or design doc here."
                      : "Describe the parts, how requests and messages move between them, and what must always be true."
                  }
                  required
                />
                <p className="mt-1 text-right font-mono text-micro tabular-nums text-ink-3">
                  {text.length.toLocaleString("en-GB")} / {textLimit.toLocaleString("en-GB")}
                </p>
              </div>
              <div>
                <label htmlFor="intake-context" className="eyebrow mb-2 block">
                  Scale and constraints <span className="font-normal text-ink-3">(optional)</span>
                </label>
                <textarea
                  id="intake-context"
                  className="field resize-y"
                  rows={2}
                  maxLength={MAX_CONTEXT_CHARS}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g. 5,000 daily users, one region, two engineers."
                />
              </div>
              <p className="text-small text-ink-3">We send this text, plus the name and constraints if you add them.</p>
            </>
          )}

          {data.signedIn && !canAfford && !hidePaywall ? (
            <InsufficientCredits
              feature="Architecture draft"
              cost={cost}
              balance={balance}
              onDismiss={() => setHidePaywall(true)}
            >
              You can remove any item from the draft before you save it.
            </InsufficientCredits>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule-soft pt-4">
              <p className="text-small text-ink-2">
                Drafting uses <strong className="font-medium text-ink">{creditsLabel(cost)}</strong>
                {data.signedIn ? (
                  <>
                    . You have <strong className="font-medium text-ink">{balance}</strong>.
                  </>
                ) : (
                  <>. Sign in to get {WELCOME_CREDITS} free credits.</>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/projects/new?method=blank" className="btn btn-ghost">
                  or model it by hand (free)
                </Link>
                {data.signedIn ? (
                  <button type="submit" className="btn btn-primary" disabled={!canAfford || !ready}>
                    Draft the architecture <CostTag credits={cost} />
                  </button>
                ) : (
                  <Link href="/sign-in" className="btn btn-primary">
                    Sign in to draft
                  </Link>
                )}
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

type PastRun = { feature: string; output: unknown; inputSummary: unknown; createdAt: string };

type Past =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; result: IntakeResult; method: IntakeSource; draftedAt: string };

/** A draft from an earlier intake run, loaded with `/projects/new?run=<id>`. */
export function PastIntake({ runId }: { runId: string }) {
  const [past, setPast] = useState<Past>({ status: "loading" });

  useEffect(() => {
    let stale = false;
    fetch(`/api/ai/runs/${encodeURIComponent(runId)}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ run?: PastRun }>) : null))
      .catch(() => null)
      .then((json) => {
        if (stale) return;
        const run = json?.run;
        setPast(
          run?.feature === "intake" && isIntakeResult(run.output)
            ? { status: "ready", result: run.output, method: methodOf(run.inputSummary), draftedAt: run.createdAt }
            : { status: "missing" },
        );
      });
    return () => {
      stale = true;
    };
  }, [runId]);

  if (past.status === "loading") return <Skeleton lines={4} />;
  if (past.status === "missing") {
    return (
      <Callout tone="failure" title="We couldn't open that draft">
        It may have been deleted, or it belongs to another account.{" "}
        <Link href="/projects/new" className="link">
          Start a new project
        </Link>
        .
      </Callout>
    );
  }
  return (
    <DraftReview
      result={past.result}
      runId={runId}
      provenance={provenanceLine(past.method, past.result.source, past.draftedAt)}
    />
  );
}

function isIntakeResult(value: unknown): value is IntakeResult {
  if (typeof value !== "object" || value === null || !("draft" in value) || !("source" in value)) return false;
  if (!("dropped" in value) || !Array.isArray(value.dropped)) return false;
  return typeof value.draft === "object" && value.draft !== null && "components" in value.draft;
}

function methodOf(summary: unknown): IntakeSource {
  const method = typeof summary === "object" && summary !== null && "method" in summary ? summary.method : undefined;
  return method === "readme" || method === "repository" ? method : "description";
}
