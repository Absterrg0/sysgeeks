"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDraft } from "@/components/exercise/use-draft";
import { ComparePanel } from "@/components/playground/compare-panel";
import { DefendPanel } from "@/components/playground/defend-panel";
import { PlaygroundAi } from "@/components/playground/playground-ai";
import {
  Debrief,
  GoalPlate,
  ScenarioSwitch,
  Stuck,
  type Help,
  useScenarioProgress,
  type ScenarioSource,
} from "@/components/playground/scenario";
import { SystemMap } from "@/components/system-map";
import { setHash, useHash } from "@/lib/client/use-hash";
import type { ComponentKind, FlowKind } from "@/lib/domain/taxonomy";
import {
  PART_INFO,
  ROLES,
  insertInFront,
  partsFor,
  playModelOf,
  removePart,
  simulate,
  trafficLevels,
  tune,
  type Part,
  type PlayModel,
  type Simulation,
  type Workload,
} from "@/lib/domain/playground";
import {
  answeredShare,
  formatAvailability,
  formatLatency,
  formatRate,
  percent,
  playInsights,
  type Insight,
} from "@/lib/domain/playground-insights";
import {
  checkScenario,
  recordReveal,
  recordSolve,
  scenarioKey,
  scenarioWorkload,
  startOf,
  type Scenario,
} from "@/lib/domain/scenarios";

type SystemInput = {
  components: {
    id: string;
    label: string;
    kind: ComponentKind;
    responsibility: string;
    position: { col: number; row: number };
  }[];
  flows: { id: string; from: string; to: string; label: string; kind: FlowKind }[];
};

export type PlaygroundWriteup = {
  id: string;
  title: string;
  url: string;
  company: string;
  note: string;
  conceptIds: string[];
  /** Written about this very system. */
  forThis: boolean;
};

const DRAFT_VERSION = 1;

type Draft = { v: typeof DRAFT_VERSION; model: PlayModel };

/** A saved design, if it is one this version can read. */
function parseDraft(raw: unknown): Draft | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const draft = raw as { v?: unknown; model?: PlayModel };
  const model = draft.model;
  if (draft.v !== DRAFT_VERSION || !model) return undefined;
  if (
    !Array.isArray(model.components) ||
    !Array.isArray(model.flows) ||
    !model.tuning ||
    typeof model.tuning !== "object"
  ) {
    return undefined;
  }
  return { v: DRAFT_VERSION, model };
}

const TONE_LED: Record<Insight["tone"], string> = {
  gain: "led-strong",
  cost: "led-partial",
  risk: "led-gap",
  info: "led-idle",
};
const TONE_LABEL: Record<Insight["tone"], string> = { gain: "Gain", cost: "Cost", risk: "Risk", info: "Note" };

/**
 * The scenario named in the URL's #fragment ("#scenario=campaign-launch"), so a scenario can be linked to.
 * "&fresh=1" asks for it from its starting design: Review sends people back to solve it again from scratch.
 */
function scenarioOf(hash: string): { id: string | null; fresh: boolean } {
  const params = new URLSearchParams(hash);
  return { id: params.get("scenario"), fresh: params.get("fresh") === "1" };
}

/**
 * A system you can change and break. The diagram runs the simulation: parts carry their load, glow when
 * hot, stack when there are several, and go red when they fail. Everything is free and instant.
 *
 * Scenarios put the system in a situation and say what has to hold; the same model checks it on every
 * edit, and a debrief says what it cost and how the real system dealt with it.
 */
export function Playground({
  investigation,
  system,
  workload: baseWorkload,
  concepts,
  writeups,
  scenarios = [],
}: {
  investigation: { id: string; title: string; searchTitle: string };
  system: SystemInput;
  workload: Workload;
  concepts: Record<string, { title: string; summary: string }>;
  writeups: PlaygroundWriteup[];
  scenarios?: Scenario[];
}) {
  const reference = useMemo(() => playModelOf(system, baseWorkload), [system, baseWorkload]);
  const { id: scenarioId, fresh } = scenarioOf(useHash());
  const scenario = scenarios.find((s) => s.id === scenarioId);
  const pickScenario = (id: string | null) => {
    setHash(id ? `scenario=${id}` : "");
    setSelected(null);
  };
  // The design each scenario starts from, and the one free play starts from.
  const baseline = useMemo(() => (scenario ? startOf(reference, scenario) : reference), [reference, scenario]);
  const [draft, store, discard] = useDraft<Draft | undefined>(
    scenario ? `playground:${investigation.id}:${scenario.id}` : `playground:${investigation.id}`,
    parseDraft,
    () => undefined,
  );
  const model = draft?.model ?? baseline;
  const setModel = (next: PlayModel) => store({ v: DRAFT_VERSION, model: next });
  const levels = trafficLevels(baseWorkload);
  const [level, setLevel] = useState<(typeof levels)[number]["id"]>("peak");
  const workload = scenario ? scenarioWorkload(baseWorkload, scenario) : baseWorkload;
  const traffic = scenario ? scenario.traffic : (levels.find((l) => l.id === level)?.multiplier ?? 1);
  const [selected, setSelected] = useState<string | null>(null);

  // A few dozen parts at most: cheap enough to run on every render. In a scenario the check runs the
  // design with the situation's faults applied, and the baseline is the scenario's starting design.
  const check = scenario ? checkScenario({ model, reference, workload: baseWorkload, scenario }) : undefined;
  const baselineCheck = scenario
    ? checkScenario({ model: baseline, reference, workload: baseWorkload, scenario })
    : undefined;
  const live = check?.model ?? model;
  const sim = check?.sim ?? simulate(model, workload, traffic);
  const referenceSim = baselineCheck?.sim ?? simulate(reference, workload, traffic);
  const insights = playInsights({
    model: live,
    sim,
    reference: baselineCheck?.model ?? reference,
    referenceSim,
    workload,
    traffic,
  });
  const changed = draft !== undefined;
  const selectedPart = selected ? model.components.find((c) => c.id === selected) : undefined;
  const labelOf = (id: string) =>
    model.components.find((c) => c.id === id)?.label ?? reference.components.find((c) => c.id === id)?.label ?? id;
  const isDatabase = (id: string) =>
    (model.components.find((c) => c.id === id) ?? reference.components.find((c) => c.id === id))?.role ===
    "database";
  const opLabel = (id: string) => workload.operations.find((o) => o.id === id)?.label ?? id;
  const sources: Record<string, ScenarioSource> = Object.fromEntries(
    writeups.map((w) => [w.id, { id: w.id, title: w.title, url: w.url, company: w.company }]),
  );

  // Remember a pass, so the switch can mark it and Review can bring it back later.
  const [progress, storeProgress] = useScenarioProgress();
  const passed = Boolean(check?.passed);
  const key = scenario ? scenarioKey(investigation.id, scenario.id) : undefined;
  useEffect(() => {
    if (!passed || !key) return;
    const next = recordSolve(progress, key, new Date().toISOString());
    if (next !== progress) storeProgress(next);
  }, [passed, key, progress, storeProgress]);
  const nextScenario = scenario ? scenarios[scenarios.indexOf(scenario) + 1] : undefined;
  useEffect(() => {
    if (!fresh || !scenario) return;
    discard();
    setHash(`scenario=${scenario.id}`);
  }, [fresh, scenario, discard]);
  const [helpBy, setHelpBy] = useState<Record<string, Help>>({});

  const annotations = mapAnnotations(model, sim);

  const trafficLabel = scenario
    ? `${scenario.title.toLowerCase()} traffic`
    : `${levels.find((l) => l.id === level)?.label.toLowerCase()} traffic`;

  return (
    <div className="relative isolate pt-10 sm:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3 border-b border-rule pt-8 pb-5 sm:pt-10">
        <div className="min-w-0 max-w-3xl">
          <p className="mb-1.5 text-[0.8125rem] text-ink-3">
            <Link href={`/investigations/${investigation.id}`} className="hover:text-ink">
              {investigation.searchTitle}
            </Link>
            <span className="mx-1.5 text-rule-strong">/</span>
            Playground
          </p>
          <h1 className="font-display text-[1.625rem] leading-[1.15] tracking-[-0.02em] text-balance">
            {investigation.title}
            {scenarios.length > 0 && (
              <span className="ml-2.5 align-middle font-mono text-[0.8125rem] tracking-normal text-ink-3">
                {scenarios.length} scenario{scenarios.length === 1 ? "" : "s"}
              </span>
            )}
          </h1>
          <p className="mt-1.5 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2 text-pretty">
            Change the design, break it, and see what each change buys and costs. The same design always gives the same
            numbers, at once.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!changed}
          onClick={() => {
            discard();
            setSelected(null);
          }}
        >
          {scenario ? "Start the scenario over" : "Back to the reference design"}
        </button>
      </header>

      <div className="mt-6 grid gap-x-6 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <figure className="screen relative" aria-label={`${investigation.title}, running at ${trafficLabel}`}>
            {/* The display's top edge carries its controls: which situation, and how much traffic. */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-rule-soft px-3 py-2.5 sm:px-4">
              {scenarios.length > 0 ? (
                <ScenarioSwitch
                  investigationId={investigation.id}
                  scenarios={scenarios}
                  active={scenario}
                  progress={progress}
                  onPick={pickScenario}
                />
              ) : (
                <span className="kicker flex items-center gap-2 pl-1">
                  <span className="led led-strong led-pulse" aria-hidden="true" />
                  Running
                </span>
              )}
              {scenario ? (
                <span className="kicker flex items-center gap-2 pr-1">
                  <span className="led led-strong led-pulse" aria-hidden="true" />
                  {traffic}× average traffic
                </span>
              ) : (
                <fieldset className="min-w-0">
                  <legend className="sr-only">Traffic</legend>
                  <div className="inline-flex gap-0.5 rounded-[11px] bg-well p-[3px] shadow-[var(--shadow-well)]">
                    {levels.map((l) => (
                      <label
                        key={l.id}
                        className={`cursor-pointer rounded-[8px] px-3 py-1.5 text-[0.8125rem] font-medium transition-[box-shadow,color,background-color] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-solid ${
                          level === l.id
                            ? "bg-[linear-gradient(var(--key-top),var(--key-bottom))] text-ink shadow-[var(--shadow-btn)]"
                            : "text-ink-3 hover:text-ink"
                        }`}
                      >
                        <input
                          type="radio"
                          name="traffic"
                          value={l.id}
                          checked={level === l.id}
                          onChange={() => setLevel(l.id)}
                          className="sr-only"
                        />
                        {l.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
            <p className="border-b border-rule-soft px-4 py-2.5 text-[0.8125rem] leading-relaxed text-ink-2 text-pretty sm:px-5">
              {scenario ? scenario.situation : workload.note}
            </p>
            <div className="px-3 py-6 max-sm:overflow-x-auto sm:px-8">
              <SystemMap
                bare
                compact
                live
                hideDetails
                label={`${investigation.title}: the design you are playing with`}
                components={model.components.map((c) => ({
                  id: c.id,
                  label: c.label,
                  kind: c.kind,
                  responsibility: c.responsibility,
                  position: c.position,
                }))}
                flows={model.flows}
                failedComponents={model.components
                  .filter((c) => sim.components[c.id]?.status === "down")
                  .map((c) => c.id)}
                flowLoads={sim.flows}
                annotations={annotations}
                selectedId={selected}
                onSelect={setSelected}
              />
            </div>
          </figure>

          {scenario && check ? (
            <>
              <GoalPlate
                check={check}
                scenario={scenario}
                opLabel={opLabel}
                labelOf={labelOf}
                isDatabase={isDatabase}
                onPick={setSelected}
              />
              {check.passed && (
                <>
                  <Debrief
                    scenario={scenario}
                    sources={sources}
                    concepts={concepts}
                    next={nextScenario}
                    onNext={pickScenario}
                  />
                  <DefendPanel
                    key={scenario.id}
                    model={check.model}
                    workload={check.workload}
                    traffic={scenario.traffic}
                    onPick={setSelected}
                    intro="It holds. Now the interviewer follows up about your design, in this situation. Say what you expect, then see what the model says."
                  />
                </>
              )}
            </>
          ) : (
            <Summary sim={sim} referenceSim={referenceSim} changed={changed} />
          )}
          <Operations sim={sim} referenceSim={referenceSim} labelOf={labelOf} />
          <Insights
            insights={insights}
            concepts={concepts}
            writeups={writeups}
            onPick={setSelected}
            baseline={scenario ? "the scenario's starting design" : "the reference design"}
          />
          <ComparePanel
            key={scenario?.id ?? "free"}
            storageKey={scenario ? `playground-compare:${investigation.id}:${scenario.id}` : `playground-compare:${investigation.id}`}
            model={model}
            workload={workload}
            traffic={traffic}
            prepare={
              scenario
                ? (m) => checkScenario({ model: m, reference, workload: baseWorkload, scenario }).model
                : undefined
            }
            trafficLabel={trafficLabel}
            onRestore={(m) => {
              setModel(m);
              setSelected(null);
            }}
          />
          <PlaygroundAi
            investigation={investigation}
            model={live}
            reference={baselineCheck?.model ?? reference}
            sim={sim}
            workload={workload}
            trafficLabel={trafficLabel}
            writeups={writeups.filter((w) => w.forThis)}
            resolve={(id) => concepts[id]}
            onHighlight={(ids) => setSelected(ids[0] ?? null)}
          />
        </div>

        <aside aria-label="The selected part" className="lg:sticky lg:top-24 lg:self-start">
          {selectedPart ? (
            <Inspector
              key={selectedPart.id}
              model={model}
              sim={sim}
              id={selectedPart.id}
              frozen={scenario?.frozen?.filter((f) => f.componentId === selectedPart.id) ?? []}
              onChange={setModel}
              onClose={() => setSelected(null)}
              onRemoved={() => setSelected(null)}
              onInserted={setSelected}
            />
          ) : scenario ? (
            <Stuck
              scenario={scenario}
              help={helpBy[scenario.id] ?? { hints: 0, answer: false }}
              onHelp={(help) => setHelpBy({ ...helpBy, [scenario.id]: help })}
              labelOf={labelOf}
              isDatabase={isDatabase}
              onPick={setSelected}
              onReveal={() => {
                if (key) storeProgress(recordReveal(progress, key, new Date().toISOString()));
              }}
            />
          ) : (
            <Ideas
              model={model}
              sim={sim}
              onPick={setSelected}
              onTraffic={() => setLevel("growth")}
              scenarios={scenarios}
              onScenario={pickScenario}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

/** What the diagram shows on each part: its load and how busy it is, stacked copies, and trouble. */
export function mapAnnotations(model: PlayModel, sim: Simulation) {
  return Object.fromEntries(
    model.components
      .filter((c) => c.role !== "client")
      .map((c) => {
        const r = sim.components[c.id];
        const t = model.tuning[c.id];
        const load = (r?.reads ?? 0) + (r?.writes ?? 0);
        const copies = c.role === "database" ? (r?.alive ?? 1) * (1 + (t?.replicas ?? 0)) : (r?.alive ?? 1);
        const tone =
          r?.status === "over" || (r?.lost ?? 0) > 0
            ? ("over" as const)
            : r?.status === "hot"
              ? ("hot" as const)
              : undefined;
        const text =
          r?.status === "down"
            ? "down"
            : r && r.lost > 0
              ? `${percent(r.lost)} lost`
              : load > 0
                ? `${formatRate(load)}${ROLES[c.role].managed ? "" : ` · ${percent(r?.utilization ?? 0)}`}`
                : undefined;
        return [
          c.id,
          {
            text,
            tone,
            stack: ROLES[c.role].managed ? 1 : copies,
            utilization: ROLES[c.role].managed || load === 0 ? undefined : (r?.utilization ?? 0),
          },
        ];
      }),
  );
}

export function Summary({ sim, referenceSim, changed }: { sim: Simulation; referenceSim: Simulation; changed: boolean }) {
  const failed = sim.operations.reduce((sum, o) => sum + o.failed, 0);
  const offered = sim.operations.filter((o) => !o.background).reduce((sum, o) => sum + o.offered, 0);
  const backlog = sim.operations.reduce((sum, o) => sum + o.backlog, 0);
  const cells = [
    {
      label: "Requests failing",
      value: offered > 0 ? percent(failed / offered) : "0%",
      tone: failed > 0 ? "text-signal-gap" : "",
    },
    {
      label: "Backlog growing",
      value: backlog > 0 ? formatRate(backlog) : "none",
      tone: backlog > 0 ? "text-signal-partial" : "",
    },
    {
      label: "Instances running",
      value: `${sim.instances.toLocaleString("en-US")}`,
      was:
        changed && sim.instances !== referenceSim.instances
          ? referenceSim.instances.toLocaleString("en-US")
          : undefined,
      tone: "",
    },
  ];
  return (
    <dl className="plate plate-grid mt-4 grid-cols-3">
      {cells.map((cell) => (
        <div key={cell.label} className="px-4 py-3">
          <dt className="kicker text-[0.625rem]">{cell.label}</dt>
          <dd className={`mt-1.5 font-mono text-[1rem] tabular-nums ${cell.tone}`}>
            {cell.value}
            {cell.was && <span className="ml-2 text-[0.75rem] text-ink-3">was {cell.was}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Operations({
  sim,
  referenceSim,
  labelOf,
}: {
  sim: Simulation;
  referenceSim: Simulation;
  labelOf: (id: string) => string;
}) {
  return (
    <section aria-labelledby="operations" className="mt-8">
      <h2 id="operations" className="font-display text-[1.25rem] tracking-[-0.015em]">
        What goes through it
      </h2>
      <div className="plate mt-3 overflow-x-auto">
        <table className="data-table min-w-[38rem] [&_td]:px-4 [&_th]:px-4 [&_thead_th]:whitespace-nowrap">
          <thead>
            <tr>
              <th scope="col">Operation</th>
              <th scope="col" className="text-right">
                Offered
              </th>
              <th scope="col">Outcome</th>
              <th scope="col" className="text-right">
                Avg wait
              </th>
              <th scope="col" className="text-right">
                p99
              </th>
              <th scope="col" className="text-right">
                Up
              </th>
            </tr>
          </thead>
          <tbody>
            {sim.operations.map((o) => {
              const before = referenceSim.operations.find((r) => r.id === o.id);
              const outcome = !o.reachable
                ? { led: "led-gap", text: `Cut off at ${labelOf(o.blockedBy ?? "")}`, tone: "text-signal-gap" }
                : o.failed > 0.005 * o.offered
                  ? { led: "led-gap", text: `${formatRate(o.failed)} failing`, tone: "text-signal-gap" }
                  : o.backlog > 0.005 * o.offered
                    ? { led: "led-partial", text: `Backlog +${formatRate(o.backlog)}`, tone: "text-signal-partial" }
                    : { led: "led-strong", text: o.background ? "Keeping up" : "All served", tone: "text-ink-2" };
              const waitChanged =
                before &&
                before.reachable &&
                Math.abs(before.latencyMs - o.latencyMs) > 0.05 * Math.max(1, before.latencyMs);
              const tailChanged =
                before &&
                before.reachable &&
                (before.saturated !== o.saturated || Math.abs(before.p99Ms - o.p99Ms) > 0.05 * Math.max(1, before.p99Ms));
              return (
                <tr key={o.id}>
                  <th scope="row">
                    {o.label}
                    {o.background && (
                      <span className="ml-2 font-mono text-[0.625rem] text-ink-3 uppercase">background</span>
                    )}
                  </th>
                  <td className="text-right font-mono tabular-nums">{formatRate(o.offered)}</td>
                  <td>
                    <span className={`inline-flex items-center gap-2 ${outcome.tone}`}>
                      <span className={`led ${outcome.led}`} aria-hidden="true" />
                      {outcome.text}
                    </span>
                  </td>
                  <td className="text-right font-mono tabular-nums">
                    {o.background || !o.reachable ? "–" : formatLatency(o.latencyMs)}
                    {waitChanged && !o.background && (
                      <span className="block text-[0.6875rem] text-ink-3">was {formatLatency(before.latencyMs)}</span>
                    )}
                  </td>
                  <td className="text-right font-mono tabular-nums">
                    {o.background || !o.reachable ? (
                      "–"
                    ) : o.saturated ? (
                      <span className="text-signal-gap" title="A part it waits on is over capacity, so its queue keeps growing">
                        no limit
                      </span>
                    ) : (
                      formatLatency(o.p99Ms)
                    )}
                    {tailChanged && !o.background && o.reachable && (
                      <span className="block text-[0.6875rem] text-ink-3">
                        was {before.saturated ? "no limit" : formatLatency(before.p99Ms)}
                      </span>
                    )}
                  </td>
                  <td className="text-right font-mono tabular-nums">
                    {o.background ? "–" : formatAvailability(o.availability)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.75rem] text-ink-3">
        Avg wait is the expected time a caller waits, and p99 the time 99 in 100 callers finish within. Up is the share of
        time every part it waits on is running.
      </p>
      <TailAssumptions />
    </section>
  );
}

/** What the p99 assumes, in plain words, for anyone who wants to check it. */
export function TailAssumptions() {
  return (
    <details className="group mt-2 text-[0.75rem] text-ink-3">
      <summary className="cursor-pointer list-none underline decoration-dotted underline-offset-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        How the p99 is worked out
      </summary>
      <ul className="mt-2 max-w-[72ch] list-disc space-y-1 pl-4 leading-relaxed text-ink-2">
        <li>
          It is calculated, not sampled, so the same design always gives the same number. Change one thing and only what
          that change caused moves.
        </li>
        <li>
          Each instance is a queue: requests arrive at random, and the time each takes varies like an exponential (most
          are quick, a few take several times the average). A part at utilisation <i>u</i> then takes its normal time ÷
          (1 − <i>u</i>) on average, which is the average wait shown.
        </li>
        <li>
          Times at queues in a row are independent of each other (Reich, 1957), so a request’s total is a sum of
          exponentials, and its p99 can be worked out exactly from them.
        </li>
        <li>
          A cache or CDN that answers a request ends its trip early. If more than 1 in 100 requests miss, the p99 is set
          by the misses, however fast the hits are.
        </li>
        <li>
          Parts a provider runs (a CDN, a managed store, a third-party API) scale out rather than queue, so only their own
          time counts. A round trip between regions is a fixed delay.
        </li>
        <li>
          Over capacity there is no steady state: the queue grows until requests time out, so the p99 shows “no limit”.
          Real queues have time limits and real work is less regular than this; read the numbers as how a design
          behaves, not as a promise.
        </li>
      </ul>
    </details>
  );
}

export function Insights({
  insights,
  concepts,
  writeups,
  onPick,
  baseline,
}: {
  insights: { changes: Insight[]; now: Insight[] };
  concepts: Record<string, { title: string; summary: string }>;
  writeups: PlaygroundWriteup[];
  onPick: (id: string) => void;
  /** What the changes are measured against, in words. */
  baseline: string;
}) {
  const sourceFor = (insight: Insight) => {
    const matching = writeups.filter((w) => w.conceptIds.some((id) => insight.conceptIds.includes(id)));
    return matching.find((w) => w.forThis) ?? matching[0];
  };
  const group = (title: string, items: Insight[], empty: string) => (
    <section className="mt-8">
      <h2 className="font-display text-[1.25rem] tracking-[-0.015em]">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-[0.875rem] text-ink-3">{empty}</p>
      ) : (
        <ul className="plate mt-3">
          {items.map((insight) => {
            const source = sourceFor(insight);
            return (
              <li key={insight.id} className="plate-row px-4 py-3.5 sm:px-5">
                <div className="flex items-start gap-3">
                  <span className={`led ${TONE_LED[insight.tone]} mt-[0.45rem]`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.9375rem] font-medium leading-snug">
                      <span className="sr-only">{TONE_LABEL[insight.tone]}: </span>
                      {insight.componentIds[0] ? (
                        <button
                          type="button"
                          className="text-left hover:text-accent"
                          onClick={() => onPick(insight.componentIds[0] as string)}
                        >
                          {insight.title}
                        </button>
                      ) : (
                        insight.title
                      )}
                    </p>
                    <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-2">{insight.detail}</p>
                    {(insight.conceptIds.length > 0 || source) && (
                      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">
                        {insight.conceptIds
                          .filter((id) => concepts[id])
                          .map((id) => (
                            <Link key={id} href={`/concepts/${id}`} className="concept-link text-ink-2">
                              {concepts[id]?.title}
                            </Link>
                          ))}
                        {source && (
                          <a href={source.url} target="_blank" rel="noreferrer" className="text-ink-3 hover:text-ink">
                            {source.company}: {source.title} ↗
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
  return (
    <>
      {group(
        "What your changes did",
        insights.changes,
        `Nothing yet. This is ${baseline}: change something to see what it buys and costs.`,
      )}
      {group("At this traffic", insights.now, "Everything is running within capacity.")}
    </>
  );
}

function Stepper({
  label,
  value,
  min,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-medium">{label}</p>
        {hint && <p className="text-[0.75rem] text-ink-3">{hint}</p>}
      </div>
      <div className="inline-flex items-center gap-1 rounded-[10px] bg-well p-[3px] shadow-[var(--shadow-well)]">
        <button
          type="button"
          className="knob size-7"
          aria-label={`Fewer: ${label}`}
          disabled={value <= min}
          onClick={() =>
            onChange(value - Math.max(1, Math.round(value * 0.25) >= 2 && value > 8 ? Math.round(value * 0.25) : 1))
          }
        >
          −
        </button>
        <span className="w-12 text-center font-mono text-[0.8125rem] tabular-nums">
          {value.toLocaleString("en-US")}
        </span>
        <button
          type="button"
          className="knob size-7"
          aria-label={`More: ${label}`}
          onClick={() => onChange(value + (value >= 8 ? Math.max(1, Math.round(value * 0.25)) : 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function Inspector({
  model,
  sim,
  id,
  frozen,
  onChange,
  onClose,
  onRemoved,
  onInserted,
}: {
  model: PlayModel;
  sim: Simulation;
  id: string;
  /** Settings the open scenario decides, and why. */
  frozen: { field: "hitRate" | "limit"; why: string }[];
  onChange: (model: PlayModel) => void;
  onClose: () => void;
  onRemoved: () => void;
  onInserted: (id: string) => void;
}) {
  const part = model.components.find((c) => c.id === id);
  const t = model.tuning[id];
  const r = sim.components[id];
  if (!part || !t || !r) return null;
  const spec = ROLES[part.role];
  const load = r.reads + r.writes;
  const parts = partsFor(part.role);
  const meter = Math.min(1, r.utilization);
  const database = part.role === "database";
  const answered = answeredShare(sim, id);
  const frozenHitRate = frozen.find((f) => f.field === "hitRate");
  const slow = (t.slow ?? 1) > 1;
  const meterTone =
    r.status === "over"
      ? "bg-mark-gap"
      : r.status === "hot"
        ? "bg-mark-partial"
        : r.status === "down"
          ? "bg-mark-gap"
          : "bg-accent-solid";

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker text-[0.625rem]">
            {part.added ? `Added · ${part.role === "limiter" ? "rate limiter" : part.kind}` : part.kind}
          </p>
          <h2 className="mt-2 font-display text-[1.25rem] leading-tight tracking-[-0.015em]">{part.label}</h2>
        </div>
        <button type="button" className="knob size-8" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-2">{part.responsibility}</p>

      {part.role !== "client" && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-[0.8125rem]">
            <span className="text-ink-2">
              {r.status === "down" ? "Down" : load > 0 ? formatRate(load) : "Idle"}
              {r.absorbed > 0 && <span className="text-ink-3"> · answers {formatRate(r.absorbed)}</span>}
              {r.rejected > 0 && <span className="text-signal-gap"> · rejects {formatRate(r.rejected)}</span>}
              {r.lost > 0 && <span className="text-signal-gap"> · {percent(r.lost)} lost</span>}
            </span>
            {!spec.managed && <span className="font-mono tabular-nums">{percent(r.utilization)} busy</span>}
          </div>
          {!spec.managed && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken shadow-[var(--shadow-plate)]">
              <div className={`h-full rounded-full ${meterTone}`} style={{ width: `${Math.max(2, meter * 100)}%` }} />
            </div>
          )}
          {r.spof && r.status !== "down" && (
            <p className="mt-2 flex items-center gap-2 text-[0.75rem] text-signal-gap">
              <span className="led led-gap" aria-hidden="true" />
              {database && t.instances > 1 ? "Every shard is a single point of failure" : "Single point of failure"}
            </p>
          )}
          {(part.role === "cache" || part.role === "cdn") && r.reads > 0 && t.hitRate - answered > 0.005 && (
            <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-3">
              Answers {percent(answered)} of what reaches it, not {percent(t.hitRate)}: a cache in front already
              answers the popular keys, so this one sees the long tail.
            </p>
          )}
        </div>
      )}

      {parts.length > 0 && (
        <div className="mt-5">
          <p className="kicker text-[0.625rem]">Put in front of it</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {parts.map((p: Part) => (
              <button
                key={p}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const next = insertInFront(model, id, p);
                  onChange(next);
                  const added = next.components.find((c) => c.added && !model.components.some((m) => m.id === c.id));
                  if (added) onInserted(added.id);
                }}
              >
                + {PART_INFO[p].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {part.role !== "client" && !spec.managed && (
        <div className="mt-5 divide-y divide-rule-soft border-y border-rule-soft">
          {part.role === "database" ? (
            <>
              <Stepper
                label="Shards"
                hint="Primaries, each with a share of the data"
                value={t.instances}
                min={1}
                onChange={(v) => onChange(tune(model, id, { instances: v }))}
              />
              <Stepper
                label="Read replicas"
                hint="Per primary, for reads only"
                value={t.replicas}
                min={0}
                onChange={(v) => onChange(tune(model, id, { replicas: v }))}
              />
            </>
          ) : (
            <Stepper
              label="Instances"
              value={t.instances}
              min={1}
              onChange={(v) => onChange(tune(model, id, { instances: v }))}
            />
          )}
        </div>
      )}

      {(part.role === "cache" || part.role === "cdn") && (
        <label className="mt-4 block">
          <span className="flex items-baseline justify-between text-[0.8125rem]">
            <span className="font-medium">Hit rate</span>
            <span className="font-mono tabular-nums">{percent(t.hitRate)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={99}
            value={Math.round(t.hitRate * 100)}
            disabled={Boolean(frozenHitRate)}
            aria-describedby={frozenHitRate ? `${id}-frozen` : undefined}
            onChange={(e) => onChange(tune(model, id, { hitRate: Number(e.target.value) / 100 }))}
            className="mt-2 w-full accent-[var(--accent-solid)] disabled:opacity-50"
          />
          {frozenHitRate && (
            <span id={`${id}-frozen`} className="mt-1 block text-[0.75rem] leading-relaxed text-ink-3">
              Set by the scenario. {frozenHitRate.why}
            </span>
          )}
        </label>
      )}

      {part.role === "limiter" && (
        <Stepper
          label="Limit per second"
          value={t.limit}
          min={1}
          onChange={(v) => onChange(tune(model, id, { limit: v }))}
        />
      )}

      {part.role !== "client" && (
        <div className="mt-5">
          <p className="kicker text-[0.625rem]">Break it</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {database ? (
              <>
                {!t.outage && t.down < t.instances && (t.replicas > 0 || t.instances > 1) && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => onChange(tune(model, id, { down: t.down + 1 }))}
                  >
                    {t.instances > 1 ? "Kill one shard's primary" : "Kill the primary"}
                  </button>
                )}
                {!t.outage && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => onChange(tune(model, id, { down: t.instances, outage: true }))}
                  >
                    {t.replicas > 0 || t.instances > 1 ? "Kill every node" : "Kill it"}
                  </button>
                )}
              </>
            ) : (
              <>
                {t.down < t.instances && t.instances > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => onChange(tune(model, id, { down: t.down + 1 }))}
                  >
                    Kill one instance
                  </button>
                )}
                {t.down < t.instances && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => onChange(tune(model, id, { down: t.instances }))}
                  >
                    {t.instances > 1 ? "Kill all" : "Kill it"}
                  </button>
                )}
              </>
            )}
            {!slow && r.status !== "down" && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => onChange(tune(model, id, { slow: 5 }))}
              >
                Make it 5× slower
              </button>
            )}
            {(t.down > 0 || t.outage || slow) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onChange(tune(model, id, { down: 0, outage: false, slow: 1 }))}
              >
                Back to normal
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-rule-soft pt-4">
        <button
          type="button"
          className="btn btn-ghost btn-sm -ml-2.5 text-signal-gap"
          onClick={() => {
            onChange(removePart(model, id));
            onRemoved();
          }}
        >
          Remove {part.label}
        </button>
      </div>
    </div>
  );
}

/** With nothing selected: a few things worth trying on this design, at this traffic. */
export function Ideas({
  model,
  sim,
  onPick,
  onTraffic,
  scenarios,
  onScenario,
}: {
  model: PlayModel;
  sim: Simulation;
  onPick: (id: string) => void;
  onTraffic: () => void;
  scenarios: Scenario[];
  onScenario: (id: string) => void;
}) {
  const parts = model.components.filter((c) => c.role !== "client");
  const busiest = [...parts].sort(
    (a, b) => (sim.components[b.id]?.utilization ?? 0) - (sim.components[a.id]?.utilization ?? 0),
  )[0];
  const spof = parts.find((c) => sim.components[c.id]?.spof);
  const database = parts.find((c) => c.role === "database");
  const ideas = [
    busiest && {
      id: busiest.id,
      text: `${busiest.label} is the busiest part at ${percent(sim.components[busiest.id]?.utilization ?? 0)}. Take load off it.`,
    },
    spof && {
      id: spof.id,
      text:
        spof.role === "database"
          ? `${spof.label} has no replica. Kill a primary and watch what stops.`
          : `${spof.label} runs as one instance. Kill it and watch what stops.`,
    },
    database &&
      database.id !== busiest?.id && {
        id: database.id,
        text: `Put a cache in front of ${database.label}, then empty it.`,
      },
  ].filter((idea): idea is { id: string; text: string } => Boolean(idea));

  return (
    <div className="panel p-4 sm:p-5">
      <p className="kicker text-[0.625rem]">Try this</p>
      <ul className="mt-3 space-y-1.5">
        {ideas.map((idea) => (
          <li key={idea.text}>
            <button type="button" className="ticket-option w-full text-left" onClick={() => onPick(idea.id)}>
              <i aria-hidden="true" />
              {idea.text}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="ticket-option w-full text-left" onClick={onTraffic}>
            <i aria-hidden="true" />
            Turn traffic up to 10× growth and see what gives first.
          </button>
        </li>
      </ul>
      {scenarios.length > 0 && (
        <div className="mt-5 border-t border-rule-soft pt-4">
          <p className="kicker text-[0.625rem]">Or take on a situation</p>
          <ul className="mt-2 space-y-1">
            {scenarios.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-hover"
                  onClick={() => onScenario(s.id)}
                >
                  <span className="block text-[0.8125rem] font-medium">{s.title}</span>
                  <span className="block text-[0.75rem] text-ink-3">{s.summary}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-[0.75rem] leading-relaxed text-ink-3">
        Click any part in the diagram to size it, put a load balancer, cache, CDN, queue or rate limiter in front of it,
        or break it.
      </p>
    </div>
  );
}
