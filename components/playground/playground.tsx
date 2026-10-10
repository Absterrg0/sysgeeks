"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDraft } from "@/components/exercise/use-draft";
import { PlaygroundAi } from "@/components/playground/playground-ai";
import { SystemMap } from "@/components/system-map";
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
  formatAvailability,
  formatLatency,
  formatRate,
  percent,
  playInsights,
  type Insight,
} from "@/lib/domain/playground-insights";

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
 * A system you can change and break. The diagram runs the simulation: parts carry their load, glow when
 * hot, stack when there are several, and go red when they fail. Everything is free and instant.
 */
export function Playground({
  investigation,
  system,
  workload,
  concepts,
  writeups,
}: {
  investigation: { id: string; title: string; searchTitle: string };
  system: SystemInput;
  workload: Workload;
  concepts: Record<string, { title: string; summary: string }>;
  writeups: PlaygroundWriteup[];
}) {
  const reference = useMemo(() => playModelOf(system, workload), [system, workload]);
  const [draft, store, discard] = useDraft<Draft | undefined>(
    `playground:${investigation.id}`,
    parseDraft,
    () => undefined,
  );
  const model = draft?.model ?? reference;
  const setModel = (next: PlayModel) => store({ v: DRAFT_VERSION, model: next });
  const levels = trafficLevels(workload);
  const [level, setLevel] = useState<(typeof levels)[number]["id"]>("peak");
  const traffic = levels.find((l) => l.id === level)?.multiplier ?? 1;
  const [selected, setSelected] = useState<string | null>(null);

  // A few dozen parts at most: cheap enough to run on every render.
  const sim = simulate(model, workload, traffic);
  const referenceSim = simulate(reference, workload, traffic);
  const insights = playInsights({ model, sim, reference, referenceSim, workload, traffic });
  const changed = draft !== undefined;
  const selectedPart = selected ? model.components.find((c) => c.id === selected) : undefined;

  const annotations = Object.fromEntries(
    model.components
      .filter((c) => c.role !== "client")
      .map((c) => {
        const r = sim.components[c.id];
        const t = model.tuning[c.id];
        const load = (r?.reads ?? 0) + (r?.writes ?? 0);
        const copies = c.role === "database" ? (r?.alive ?? 1) * (1 + (t?.replicas ?? 0)) : (r?.alive ?? 1);
        const tone = r?.status === "over" ? ("over" as const) : r?.status === "hot" ? ("hot" as const) : undefined;
        const text =
          r?.status === "down"
            ? "down"
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

  return (
    <div className="relative isolate pt-10 sm:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3 border-b border-rule pt-8 pb-6 sm:pt-10">
        <div className="min-w-0 max-w-3xl">
          <p className="mb-2 text-[0.8125rem] text-ink-3">
            <Link href={`/investigations/${investigation.id}`} className="hover:text-ink">
              {investigation.searchTitle}
            </Link>
            <span className="mx-1.5 text-rule-strong">/</span>
            Playground
          </p>
          <h1 className="font-display text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-balance sm:text-[2rem]">
            {investigation.title}
          </h1>
          <p className="mt-2.5 max-w-[68ch] text-[0.9375rem] leading-relaxed text-ink-2 text-pretty">
            Click a part to change it, put something in front of it, or kill it. Turn the traffic up. Every number moves
            as you go; nothing is graded. {workload.note}
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-x-6 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <figure
            className="screen relative"
            aria-label={`${investigation.title}, running at ${levels.find((l) => l.id === level)?.label.toLowerCase()} traffic`}
          >
            {/* The display's top edge carries its controls: how much traffic, and a way back. */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule-soft px-3 py-2.5 sm:px-4">
              <span className="kicker flex items-center gap-2 pl-1">
                <span className="led led-strong led-pulse" aria-hidden="true" />
                Running
              </span>
              <div className="flex flex-wrap items-center gap-3">
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
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!changed}
                  onClick={() => {
                    discard();
                    setSelected(null);
                  }}
                >
                  Back to the reference design
                </button>
              </div>
            </div>
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

          <Summary sim={sim} referenceSim={referenceSim} changed={changed} />
          <Operations
            sim={sim}
            referenceSim={referenceSim}
            labelOf={(id) => model.components.find((c) => c.id === id)?.label ?? id}
          />
          <Insights insights={insights} concepts={concepts} writeups={writeups} onPick={setSelected} />
          <PlaygroundAi
            investigation={investigation}
            model={model}
            reference={reference}
            sim={sim}
            workload={workload}
            trafficLabel={levels.find((l) => l.id === level)?.label ?? "average"}
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
              onChange={setModel}
              onClose={() => setSelected(null)}
              onRemoved={() => setSelected(null)}
              onInserted={setSelected}
            />
          ) : (
            <Ideas model={model} sim={sim} onPick={setSelected} onTraffic={() => setLevel("growth")} />
          )}
        </aside>
      </div>
    </div>
  );
}

function Summary({ sim, referenceSim, changed }: { sim: Simulation; referenceSim: Simulation; changed: boolean }) {
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

function Operations({
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
        <table className="data-table min-w-[36rem] [&_td]:px-4 [&_th]:px-4">
          <thead>
            <tr>
              <th scope="col">Operation</th>
              <th scope="col" className="text-right">
                Offered
              </th>
              <th scope="col">Outcome</th>
              <th scope="col" className="text-right">
                Wait
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
                    {o.background ? "–" : formatAvailability(o.availability)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.75rem] text-ink-3">
        Wait is the expected time a caller waits; Up is the share of time every part it waits on is running.
      </p>
    </section>
  );
}

function Insights({
  insights,
  concepts,
  writeups,
  onPick,
}: {
  insights: { changes: Insight[]; now: Insight[] };
  concepts: Record<string, { title: string; summary: string }>;
  writeups: PlaygroundWriteup[];
  onPick: (id: string) => void;
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
        "Nothing yet. This is the reference design: change something to see what it buys and costs.",
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

function Inspector({
  model,
  sim,
  id,
  onChange,
  onClose,
  onRemoved,
  onInserted,
}: {
  model: PlayModel;
  sim: Simulation;
  id: string;
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
              Single point of failure
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
            onChange={(e) => onChange(tune(model, id, { hitRate: Number(e.target.value) / 100 }))}
            className="mt-2 w-full accent-[var(--accent-solid)]"
          />
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
            {t.down > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onChange(tune(model, id, { down: 0 }))}
              >
                Bring it back
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
function Ideas({
  model,
  sim,
  onPick,
  onTraffic,
}: {
  model: PlayModel;
  sim: Simulation;
  onPick: (id: string) => void;
  onTraffic: () => void;
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
    spof && { id: spof.id, text: `${spof.label} runs as one instance. Kill it and watch what stops.` },
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
      <p className="mt-4 text-[0.75rem] leading-relaxed text-ink-3">
        Click any part in the diagram to size it, put a load balancer, cache, CDN, queue or rate limiter in front of it,
        or break it.
      </p>
    </div>
  );
}
