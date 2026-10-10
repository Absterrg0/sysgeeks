"use client";

import { useEffect, useState } from "react";
import { CreditCost } from "@/components/account/credit-cost";
import { InsufficientCredits } from "@/components/account/insufficient-credits";
import { SignInGate } from "@/components/account/sign-in-gate";
import { AiError } from "@/components/ai-run/ai-error";
import { ProgressSteps, type ProgressStep } from "@/components/ai-run/progress-steps";
import { Callout } from "@/components/feedback";
import type { ConceptResolver } from "@/components/prose-core";
import { loadLatestReport, type Report } from "@/components/projects/review/review-tab";
import { ReportView } from "@/components/projects/review/report-view";
import { AiFailure, type AiErrorCode } from "@/lib/ai/errors";
import type { Review } from "@/lib/ai/schemas";
import { useAccount } from "@/lib/client/account";
import { runAi } from "@/lib/client/ai";
import { MAX_PROJECT_CONTEXT } from "@/lib/domain/learner";
import { modelHash } from "@/lib/domain/model-hash";
import { PART_INFO, type Part, type PlayModel, type Simulation, type Workload } from "@/lib/domain/playground";
import { formatAvailability, formatLatency, formatRate, percent } from "@/lib/domain/playground-insights";
import { creditCost } from "@/lib/domain/pricing";

type ReviewOutput = { review: Review; modelHash: string; model: string };

export type GroundingWriteup = { title: string; company: string; url: string; note: string };

/** The design as the review reads it: parts, flows and nothing about layout. */
function reviewModel(model: PlayModel) {
  return {
    components: model.components.map((c) => ({
      id: c.id,
      label: c.label,
      kind: c.kind,
      responsibility: c.responsibility,
    })),
    flows: model.flows.map((f) => ({ id: f.id, from: f.from, to: f.to, label: f.label, kind: f.kind })),
    invariants: [],
  };
}

/** What the learner changed, against the reference design, in plain sentences. */
export function describeChanges(model: PlayModel, reference: PlayModel): string[] {
  const name = (m: PlayModel, id: string) => m.components.find((c) => c.id === id)?.label ?? id;
  const lines: string[] = [];
  for (const c of model.components.filter((c) => c.added)) {
    const onward = model.flows.find((f) => f.from === c.id && f.added)?.to;
    lines.push(
      `Added a ${PART_INFO[c.role as Part]?.label.toLowerCase() ?? c.label} in front of ${onward ? name(model, onward) : "nothing"}.`,
    );
  }
  for (const c of reference.components.filter((r) => !model.components.some((c) => c.id === r.id))) {
    lines.push(`Removed ${c.label}.`);
  }
  for (const c of model.components.filter((c) => !c.added)) {
    const t = model.tuning[c.id];
    const r = reference.tuning[c.id];
    if (!t || !r) continue;
    const label = c.role === "database" ? "shards" : "instances";
    if (t.instances !== r.instances) lines.push(`${c.label}: ${t.instances} ${label} instead of ${r.instances}.`);
    if (t.replicas !== r.replicas)
      lines.push(`${c.label}: ${t.replicas} read replicas per primary instead of ${r.replicas}.`);
    if (t.hitRate !== r.hitRate && (c.role === "cache" || c.role === "cdn")) {
      lines.push(`${c.label}: hit rate ${percent(t.hitRate)} instead of ${percent(r.hitRate)}.`);
    }
  }
  for (const c of model.components) {
    const t = model.tuning[c.id];
    if (t && t.down > 0) lines.push(`${c.label}: ${t.down} of ${t.instances} instances killed.`);
  }
  return lines;
}

function contextFor(input: {
  workload: Workload;
  trafficLabel: string;
  model: PlayModel;
  sim: Simulation;
  writeups: GroundingWriteup[];
}): string {
  const { workload, trafficLabel, model, sim, writeups } = input;
  const name = (id: string) => model.components.find((c) => c.id === id)?.label ?? id;
  const ops = sim.operations.map((o) =>
    o.reachable
      ? `- ${o.label}: ${formatRate(o.offered)} offered; ${
          o.background
            ? o.backlog > 0
              ? `backlog grows ${formatRate(o.backlog)}`
              : "keeping up"
            : `${formatRate(o.failed)} failing, wait ${formatLatency(o.latencyMs)}, up ${formatAvailability(o.availability)}`
        }`
      : `- ${o.label}: cut off at ${name(o.blockedBy ?? "")}`,
  );
  const parts = model.components
    .filter((c) => c.role !== "client")
    .map((c) => {
      const r = sim.components[c.id];
      if (!r) return "";
      const flags = [r.status === "down" ? "DOWN" : "", r.spof ? "single point of failure" : ""].filter(Boolean);
      return `- ${c.label} (${c.id}): ${formatRate(r.reads + r.writes)}, ${percent(r.utilization)} busy, ${r.alive} running${flags.length ? `, ${flags.join(", ")}` : ""}`;
    })
    .filter(Boolean);
  const sources = writeups.map((w) => `- ${w.company}, "${w.title}" (${w.url}): ${w.note}`);
  const sections = [
    `Brief: ${workload.note}`,
    `Simulated at ${trafficLabel} traffic with a simple capacity model (rough per-instance capacities, not measurements).`,
    `Operations:\n${ops.join("\n")}`,
    `Parts:\n${parts.join("\n")}`,
    `How the engineers who built systems like this describe it (cite these where they apply):\n${sources.join("\n")}`,
  ];
  let text = sections.join("\n\n");
  while (text.length > MAX_PROJECT_CONTEXT && sources.length > 0) {
    sources.pop();
    sections[4] = `How the engineers who built systems like this describe it:\n${sources.join("\n")}`;
    text = sections.join("\n\n");
  }
  return text.slice(0, MAX_PROJECT_CONTEXT);
}

/**
 * The AI's read of the design you are playing with: what each change buys and costs, where it fails at
 * this traffic, and what an interviewer would ask, grounded in the writeups behind the system.
 */
export function PlaygroundAi(props: {
  investigation: { id: string; title: string };
  model: PlayModel;
  reference: PlayModel;
  sim: Simulation;
  workload: Workload;
  trafficLabel: string;
  writeups: GroundingWriteup[];
  resolve: ConceptResolver;
  onHighlight: (componentIds: string[]) => void;
}) {
  return (
    <section aria-labelledby="ai-read" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="ai-read" className="font-display text-[1.25rem] tracking-[-0.015em]">
          Ask AI what your design does
        </h2>
        <span className="ai-label">AI</span>
      </div>
      <p className="mt-2 max-w-[66ch] text-[0.875rem] leading-relaxed text-ink-2">
        The numbers above come from a simple model. The AI reads your design, what you changed and these numbers, and
        explains where it holds and where it fails, citing how the engineers who built it did it. It can be wrong.
      </p>
      <div className="mt-4">
        <SignInGate>
          <Run {...props} />
        </SignInGate>
      </div>
    </section>
  );
}

function Run({
  investigation,
  model,
  reference,
  sim,
  workload,
  trafficLabel,
  writeups,
  resolve,
  onHighlight,
}: Parameters<typeof PlaygroundAi>[0]) {
  const account = useAccount();
  const balance = account.data?.signedIn ? account.data.balance : null;
  const [report, setReport] = useState<Report | null>(null);
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<{ code: AiErrorCode; refunded: boolean } | null>(null);
  const [paywallHidden, setPaywallHidden] = useState(false);
  const projectId = `playground-${investigation.id}`;
  const cost = creditCost("review");
  const short = balance !== null && balance < cost;
  const design = reviewModel(model);
  const stale = report !== null && report.modelHash !== modelHash(design);
  const labels = Object.fromEntries(model.components.map((c) => [c.id, c.label]));

  useEffect(() => {
    let cancelled = false;
    loadLatestReport(projectId).then((next) => {
      if (!cancelled && next) setReport(next);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function run() {
    setRunning(true);
    setSteps([]);
    setFailure(null);
    const result: { runId?: string } = {};
    const changes = describeChanges(model, reference);
    try {
      const data = await runAi<ReviewOutput>(
        "/api/ai/review",
        {
          projectId,
          name: `${investigation.title} (playground)`,
          summary: [
            "A learner's variation of a reference design, built in a playground to see what changes do.",
            "Explain what each change buys and costs compared with the reference, where the design fails at this traffic, and what to try next.",
            changes.length > 0
              ? `Changes from the reference:\n${changes.map((c) => `- ${c}`).join("\n")}`
              : "No changes: this is the reference design.",
          ]
            .join("\n")
            .slice(0, 2000),
          context: contextFor({ workload, trafficLabel, model, sim, writeups }),
          model: design,
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

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={running || short} onClick={run}>
          {running ? "Reading your design…" : report ? "Ask again about this design" : "Ask AI about this design"}
        </button>
        <CreditCost credits={cost} balance={balance ?? undefined} />
      </div>
      {short && !paywallHidden && balance !== null && (
        <InsufficientCredits
          feature="AI read of your design"
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
            <Callout tone="change" title="Your design changed since this read">
              Ask again to hear about the design as it is now.
            </Callout>
          )}
          <ReportView
            review={report.review}
            resolve={resolve}
            createdAt={report.createdAt}
            componentLabels={labels}
            onHighlight={onHighlight}
          />
        </div>
      )}
    </div>
  );
}
