"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { AddKeyPrompt, AiModelTag } from "@/components/ai-key/ai-key-gate";
import { AiError } from "@/components/ai-run/ai-error";
import { type ProgressStep, ProgressSteps } from "@/components/ai-run/progress-steps";
import { Callout, Skeleton } from "@/components/feedback";
import { DraftReview, type IntakeResult, provenanceLine } from "@/components/projects/intake/draft-review";
import { RepoFilesPreview } from "@/components/projects/intake/repo-files-preview";
import { AiFailure, type AiErrorCode } from "@/lib/ai/errors";
import type { IntakeSource } from "@/lib/ai/requests";
import { runAi } from "@/lib/client/ai";
import { useAiKey } from "@/lib/store/ai-key-store";
import { useLearnerState } from "@/lib/store/learner-store";

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
  | { kind: "running"; controller: AbortController }
  | { kind: "failed"; code: AiErrorCode; detail?: string }
  | { kind: "review"; result: IntakeResult; runId: string | null; draftedAt: string };

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The intake form for one method. Runs the draft, shows progress, then the draft review. */
export function IntakeForm({ method }: { method: IntakeSource }) {
  const saved = useAiKey();
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [text, setText] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const running = phase.kind === "running";
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  if (saved === undefined) return <Skeleton lines={3} />;

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
    const controller = new AbortController();
    setSteps([]);
    setElapsed(0);
    setPhase({ kind: "running", controller });
    try {
      const result = await runAi<IntakeResult>(
        "intake",
        body,
        (event) => {
          if (event.type === "progress") setSteps((prev) => [...prev, event]);
          if (event.type === "result") seen.runId = event.runId;
        },
        controller.signal,
      );
      const draft = name.trim() ? { ...result.draft, name: name.trim() } : result.draft;
      setPhase({
        kind: "review",
        result: { ...result, draft },
        runId: seen.runId ?? null,
        draftedAt: new Date().toISOString(),
      });
    } catch (error) {
      const failure = error instanceof AiFailure ? error : new AiFailure("ai_unavailable");
      setPhase({ kind: "failed", code: failure.code, detail: failure.detail });
    }
  };

  const ready = method === "repository" ? repoUrl.trim() !== "" : text.trim() !== "";
  const textLimit = method === "readme" ? MAX_README_CHARS : MAX_DESCRIPTION_CHARS;

  return (
    <div className="grid gap-5">
      {phase.kind === "failed" && (
        <AiError code={phase.code} detail={phase.detail} onRetry={() => setPhase({ kind: "idle" })} />
      )}

      {running ? (
        <div className="panel grid gap-4 p-5">
          <ProgressSteps steps={steps} elapsed={formatElapsed(elapsed)} onStop={() => phase.controller.abort()} />
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
                Public repositories only. Your browser reads the README, the dependency manifests and the folder layout
                from GitHub, skips secret files, and sends them to your AI provider.
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
              <p className="text-small text-ink-3">
                Your browser sends this text, plus the name and constraints if you add them, to your AI provider.
              </p>
            </>
          )}

          {saved === null ? (
            <div className="grid gap-3 border-t border-rule-soft pt-4">
              <AddKeyPrompt />
              <Link href="/projects/new?method=blank" className="link text-small justify-self-start">
                Or model it by hand, no AI needed
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule-soft pt-4">
              <AiModelTag />
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/projects/new?method=blank" className="btn btn-ghost">
                  or model it by hand
                </Link>
                <button type="submit" className="btn btn-primary" disabled={!ready}>
                  Draft the architecture
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

/** A draft from an earlier intake run saved in this browser, opened with `/projects/new?run=<id>`. */
export function PastIntake({ runId }: { runId: string }) {
  const state = useLearnerState();
  if (!state) return <Skeleton lines={4} />;
  const run = state.aiRuns.find((r) => r.id === runId);
  if (run?.feature !== "intake" || !isIntakeResult(run.output)) {
    return (
      <Callout tone="failure" title="We couldn't open that draft">
        Drafts are kept in the browser that made them, and only the last 30 AI runs are kept. It may have been deleted,
        or made in another browser.{" "}
        <Link href="/projects/new" className="link">
          Start a new project
        </Link>
        .
      </Callout>
    );
  }
  return (
    <DraftReview
      result={run.output}
      runId={runId}
      provenance={provenanceLine(methodOf(run.inputSummary), run.output.source, run.createdAt)}
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
