"use client";

import { useMemo, useState } from "react";
import { useDraft } from "@/components/exercise/use-draft";
import { ComparePanel } from "@/components/playground/compare-panel";
import { DefendPanel } from "@/components/playground/defend-panel";
import {
  Ideas,
  Insights,
  Inspector,
  Operations,
  mapAnnotations,
  type PlaygroundWriteup,
} from "@/components/playground/playground";
import { SystemMap } from "@/components/system-map";
import type { Project } from "@/lib/domain/learner";
import { modelHash } from "@/lib/domain/model-hash";
import { simulate, type Operation, type PlayModel } from "@/lib/domain/playground";
import { formatRate, playInsights } from "@/lib/domain/playground-insights";
import {
  CROSS_REGION_MS,
  DEFAULT_TRAFFIC,
  LIMITS,
  entriesOf,
  paidFor,
  parseTraffic,
  perRegion,
  perSecondFromDaily,
  projectChecks,
  projectPlay,
  targetsOf,
  type CheckStatus,
  type ProjectCheck,
  type ProjectTraffic,
} from "@/lib/domain/project-play";
import { modelOf } from "@/lib/domain/project-model";

type Draft = { v: 1; hash: string; traffic: ProjectTraffic; model?: PlayModel };

function parseDraft(raw: unknown): Draft | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as { v?: unknown; hash?: unknown; traffic?: unknown; model?: PlayModel };
  if (d.v !== 1 || typeof d.hash !== "string") return undefined;
  const m = d.model;
  const model = m && Array.isArray(m.components) && Array.isArray(m.flows) && m.tuning ? m : undefined;
  return { v: 1, hash: d.hash, traffic: parseTraffic(d.traffic), model };
}

const LEVELS = ["average", "peak", "growth"] as const;
type Level = (typeof LEVELS)[number];

const LED: Record<CheckStatus, string> = { met: "led-strong", missed: "led-gap", info: "led-idle" };
const TONE: Record<CheckStatus, string> = { met: "text-signal-strong", missed: "text-signal-gap", info: "text-ink-2" };

/**
 * Your own system under your own numbers: the same model, failures, insights and checks as the curated
 * systems, run in this browser on the parts and flows you drew. Play changes are kept apart from the drawing.
 */
export function ProjectPlay({
  project,
  concepts,
  writeups,
  onDesign,
}: {
  project: Project;
  concepts: Record<string, { title: string; summary: string }>;
  writeups: PlaygroundWriteup[];
  onDesign: () => void;
}) {
  const hash = modelHash(modelOf(project));
  const [draft, store, discard] = useDraft<Draft | undefined>(`project-play:${project.id}`, parseDraft, () => undefined);
  const traffic = draft?.traffic ?? DEFAULT_TRAFFIC;
  const drawing = useMemo(() => ({ components: project.components, flows: project.flows }), [project]);
  const { reference, workload, found } = useMemo(() => projectPlay(drawing, traffic), [drawing, traffic]);
  // A play design belongs to one version of the drawing: redraw it and play starts again from the drawing.
  const model = draft?.hash === hash && draft.model ? draft.model : reference;
  const changed = model !== reference;
  const setModel = (next: PlayModel) => store({ v: 1, hash, traffic, model: next });
  const setTraffic = (next: ProjectTraffic) =>
    store({ v: 1, hash, traffic: next, model: draft?.hash === hash ? draft.model : undefined });
  const [level, setLevel] = useState<Level>("peak");
  const [selected, setSelected] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const multiplier = level === "average" ? 1 : level === "peak" ? traffic.peak : traffic.peak * 10;
  const at = perRegion(multiplier, traffic.regions);
  const sim = simulate(model, workload, at);
  const referenceSim = simulate(reference, workload, at);
  const checks = projectChecks(model, workload, traffic);
  const insights = playInsights({ model, sim, reference, referenceSim, workload, traffic: at });
  const labelOf = (id: string) => model.components.find((c) => c.id === id)?.label ?? id;
  const selectedPart = selected ? model.components.find((c) => c.id === selected) : undefined;
  const levelLabel = (l: Level) =>
    l === "average" ? "Average" : l === "peak" ? `Peak ×${traffic.peak}` : `10× growth`;
  const trafficLabel = `${levelLabel(level).toLowerCase()} traffic`;
  const carried = workload.operations
    .filter((o) => !o.background)
    .map((o) => `${o.label.toLowerCase()} ${formatRate(o.rps * at)}`)
    .join(", ");

  if (project.components.length === 0) {
    return (
      <Empty onDesign={onDesign}>
        Play runs the parts and flows you drew. Add a client, the services it calls and where the data lives, then come
        back to put your traffic through them.
      </Empty>
    );
  }
  if (workload.operations.length === 0) {
    return (
      <Empty onDesign={onDesign}>
        Nothing to put traffic through yet. Play needs a client (or a part nothing else calls) with request flows that
        reach a store: a database, a cache, object storage or a queue.
      </Empty>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-rule pb-4">
        <div className="min-w-0 max-w-3xl">
          <h2 className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">Play it under your numbers</h2>
          <p className="mt-1.5 max-w-[72ch] text-[0.9375rem] leading-relaxed text-ink-2 text-pretty">
            Say what your system carries, then size it, break it and see what holds. Same model as every system here:
            the same design always gives the same numbers, at once, in this browser.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!changed}
          onClick={() => {
            store({ v: 1, hash, traffic });
            setSelected(null);
          }}
        >
          Back to your drawing
        </button>
      </div>

      <TrafficPanel
        key={formKey}
        project={project}
        traffic={traffic}
        found={found}
        operations={workload.operations}
        onChange={setTraffic}
        onReset={() => {
          discard();
          setFormKey((k) => k + 1);
          setSelected(null);
        }}
      />

      <div className="mt-6 grid gap-x-6 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <figure className="screen relative" aria-label={`${project.name}, running at ${trafficLabel}`}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-rule-soft px-3 py-2.5 sm:px-4">
              <span className="kicker flex items-center gap-2 pl-1">
                <span className="led led-strong led-pulse" aria-hidden="true" />
                {traffic.regions > 1 ? `One of ${traffic.regions} regions` : "Running"}
              </span>
              <fieldset className="min-w-0">
                <legend className="sr-only">Traffic</legend>
                <div className="inline-flex gap-0.5 rounded-[11px] bg-well p-[3px] shadow-[var(--shadow-well)]">
                  {LEVELS.map((l) => (
                    <label
                      key={l}
                      className={`cursor-pointer rounded-[8px] px-3 py-1.5 text-[0.8125rem] font-medium transition-[box-shadow,color,background-color] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-solid ${
                        level === l
                          ? "bg-[linear-gradient(var(--key-top),var(--key-bottom))] text-ink shadow-[var(--shadow-btn)]"
                          : "text-ink-3 hover:text-ink"
                      }`}
                    >
                      <input
                        type="radio"
                        name="project-traffic"
                        value={l}
                        checked={level === l}
                        onChange={() => setLevel(l)}
                        className="sr-only"
                      />
                      {levelLabel(l)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <p className="border-b border-rule-soft px-4 py-2.5 text-[0.8125rem] leading-relaxed text-ink-2 text-pretty sm:px-5">
              {screenNote(traffic.regions, carried, paidFor(model, traffic.regions))}
            </p>
            <div className="px-3 py-6 max-sm:overflow-x-auto sm:px-8">
              <SystemMap
                bare
                compact
                live
                hideDetails
                label={`${project.name}: the design you are playing with`}
                components={model.components.map((c) => ({
                  id: c.id,
                  label: c.label,
                  kind: c.kind,
                  responsibility: c.responsibility,
                  position: c.position,
                }))}
                flows={model.flows}
                failedComponents={model.components.filter((c) => sim.components[c.id]?.status === "down").map((c) => c.id)}
                flowLoads={sim.flows}
                annotations={mapAnnotations(model, sim)}
                selectedId={selected}
                onSelect={setSelected}
              />
            </div>
          </figure>

          <ChecksPlate checks={checks} onPick={setSelected} peak={traffic.peak} />
          <Operations sim={sim} referenceSim={referenceSim} labelOf={labelOf} />
          <Insights
            insights={insights}
            concepts={concepts}
            writeups={writeups}
            onPick={setSelected}
            baseline="your drawing, one instance of everything"
          />
          <ComparePanel
            storageKey={`project-compare:${project.id}`}
            model={model}
            workload={workload}
            traffic={at}
            regions={traffic.regions}
            trafficLabel={trafficLabel}
            onRestore={(m) => {
              setModel(m);
              setSelected(null);
            }}
          />
          <DefendPanel
            model={model}
            workload={workload}
            traffic={at}
            onPick={setSelected}
            intro={`An interviewer's follow-ups about ${project.name} at ${trafficLabel}. Say what you expect, then see what the model says.`}
          />
        </div>

        <aside aria-label="The selected part" className="lg:sticky lg:top-24 lg:self-start">
          {selectedPart ? (
            <Inspector
              key={selectedPart.id}
              model={model}
              sim={sim}
              id={selectedPart.id}
              frozen={[]}
              onChange={setModel}
              onClose={() => setSelected(null)}
              onRemoved={() => setSelected(null)}
              onInserted={setSelected}
            />
          ) : (
            <Ideas
              model={model}
              sim={sim}
              onPick={setSelected}
              onTraffic={() => setLevel("growth")}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

/** One line under the screen's controls: what each region carries, and what all of it costs. */
function screenNote(regions: number, carried: string, paid: number): string {
  const cost = `You pay for ${paid.toLocaleString("en-US")} instance${paid === 1 ? "" : "s"}`;
  if (regions <= 1) return `${carried.charAt(0).toUpperCase()}${carried.slice(1)}. ${cost}.`;
  const part = regions === 2 ? "half" : `1/${regions} share`;
  return `${regions} regions each run this design and take a ${part}: ${carried}. Sizes are per region; ${cost.charAt(0).toLowerCase()}${cost.slice(1)} across all ${regions}.`;
}

function Empty({ children, onDesign }: { children: React.ReactNode; onDesign: () => void }) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-[1.375rem] leading-tight tracking-[-0.015em]">Play it under your numbers</h2>
      <p className="mt-2 text-ui leading-relaxed text-ink-2">{children}</p>
      <button type="button" className="btn btn-secondary btn-sm mt-4" onClick={onDesign}>
        Open Design
      </button>
    </div>
  );
}

/** What has to hold at your peak. */
function ChecksPlate({ checks, onPick, peak }: { checks: ProjectCheck[]; onPick: (id: string) => void; peak: number }) {
  const scored = checks.filter((c) => c.status !== "info");
  const met = scored.filter((c) => c.status === "met").length;
  return (
    <section aria-labelledby="project-checks" className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="project-checks" className="kicker text-[0.625rem]">
          Has to hold at peak (×{peak})
        </h2>
        <p className="font-mono text-[0.75rem] text-ink-3" aria-live="polite" aria-atomic="true">
          {met === scored.length ? <span className="text-signal-strong">All {scored.length} hold</span> : `${met} of ${scored.length} hold`}
        </p>
      </div>
      <ul className="plate plate-grid mt-2 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
        {checks.map((c) => (
          <li key={c.id} className="px-4 py-3">
            <p className="flex items-start gap-2 text-[0.8125rem] leading-snug text-ink-2">
              <span className={`led ${LED[c.status]} mt-[0.4rem]`} aria-hidden="true" />
              <span>
                <span className="sr-only">
                  {c.status === "met" ? "Holds: " : c.status === "missed" ? "Does not hold: " : "Note: "}
                </span>
                {c.label}
              </span>
            </p>
            <p className="mt-1.5 pl-[0.9rem] font-mono text-[0.9375rem] tabular-nums">
              <span className={TONE[c.status]}>{c.actual}</span>
              <span className="ml-2 text-[0.75rem] text-ink-3">{c.target}</span>
            </p>
            {c.detail && <p className="mt-1 pl-[0.9rem] text-[0.75rem] leading-relaxed text-ink-3">{c.detail}</p>}
            {c.status === "missed" && c.componentIds[0] && (
              <button
                type="button"
                className="mt-1 pl-[0.9rem] text-[0.75rem] text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
                onClick={() => onPick(c.componentIds[0] as string)}
              >
                Show where
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A number you type, kept as text while you type it and handed on once it is a number in range. */
function NumberField({
  id,
  label,
  unit,
  value,
  min,
  max,
  step = "any",
  onChange,
}: {
  id: string;
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step?: string;
  onChange: (n: number) => void;
}) {
  const shown = (n: number) => String(Number(n.toFixed(3)));
  const [text, setText] = useState(shown(value));
  // When the number changes from outside (a reset, "use these averages"), show it; while typing, keep the text.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (Number(text) !== value) setText(shown(value));
  }
  const n = Number(text);
  const invalid = text.trim() === "" || !Number.isFinite(n) || n < min || n > max;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[0.75rem] text-ink-3">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={text}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            setText(e.target.value);
            const next = Number(e.target.value);
            if (e.target.value.trim() !== "" && Number.isFinite(next) && next >= min && next <= max) onChange(next);
          }}
          className="field py-1.5 font-mono text-[0.8125rem] tabular-nums"
        />
        {unit && <span className="shrink-0 text-[0.75rem] text-ink-3">{unit}</span>}
      </div>
    </div>
  );
}

function TrafficPanel({
  project,
  traffic,
  found,
  operations,
  onChange,
  onReset,
}: {
  project: Project;
  traffic: ProjectTraffic;
  found: ReturnType<typeof projectPlay>["found"];
  operations: Operation[];
  onChange: (t: ProjectTraffic) => void;
  onReset: () => void;
}) {
  const set = (patch: Partial<ProjectTraffic>) => onChange({ ...traffic, ...patch });
  const label = (id: string) => project.components.find((c) => c.id === id)?.label ?? id;
  const entries = entriesOf(project);
  const route = (kind: "read" | "write") => {
    const pick = kind === "read" ? found.read : found.write;
    if (!pick) return null;
    const entryKey = kind === "read" ? "readEntry" : "writeEntry";
    const targetKey = kind === "read" ? "readTarget" : "writeTarget";
    const targets = targetsOf(project, pick.entry, kind);
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.8125rem]">
        <span className="w-12 shrink-0 text-ink-3">{kind === "read" ? "Reads" : "Writes"}</span>
        <select
          aria-label={`${kind === "read" ? "Reads" : "Writes"} start at`}
          className="field w-auto py-1 text-[0.8125rem]"
          value={pick.entry}
          onChange={(e) => set({ [entryKey]: e.target.value, [targetKey]: undefined })}
        >
          {entries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <span className="text-ink-3" aria-hidden="true">
          →
        </span>
        <select
          aria-label={`${kind === "read" ? "Reads" : "Writes"} end at`}
          className="field w-auto py-1 text-[0.8125rem]"
          value={pick.target}
          onChange={(e) => set({ [targetKey]: e.target.value })}
        >
          {targets.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
    );
  };
  const path = (kind: "read" | "write") => {
    const op = kind === "read" ? "reads" : "writes";
    const o = operations.find((x) => x.id === op);
    return o ? o.path.map(label).join(" → ") : null;
  };
  const background = operations.filter((o) => o.background);

  return (
    <section aria-labelledby="traffic" className="plate mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule-soft px-4 py-2.5 sm:px-5">
        <h3 id="traffic" className="kicker text-[0.625rem]">
          What it carries
        </h3>
        <button type="button" className="text-[0.75rem] text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink" onClick={onReset}>
          Reset to the starting numbers
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5 sm:grid-cols-4 sm:px-5 lg:grid-cols-7">
        <NumberField id="t-reads" label="Reads, average" unit="/s" value={traffic.readsPerSecond} min={LIMITS.rate.min} max={LIMITS.rate.max} onChange={(n) => set({ readsPerSecond: n })} />
        <NumberField id="t-writes" label="Writes, average" unit="/s" value={traffic.writesPerSecond} min={LIMITS.rate.min} max={LIMITS.rate.max} onChange={(n) => set({ writesPerSecond: n })} />
        <NumberField id="t-read-kb" label="Read size" unit="KB" value={traffic.readKB} min={LIMITS.kb.min} max={LIMITS.kb.max} onChange={(n) => set({ readKB: n })} />
        <NumberField id="t-write-kb" label="Write size" unit="KB" value={traffic.writeKB} min={LIMITS.kb.min} max={LIMITS.kb.max} onChange={(n) => set({ writeKB: n })} />
        <NumberField id="t-peak" label="Peak" unit="× avg" value={traffic.peak} min={LIMITS.peak.min} max={LIMITS.peak.max} onChange={(n) => set({ peak: n })} />
        <NumberField id="t-regions" label="Regions" value={traffic.regions} min={LIMITS.regions.min} max={LIMITS.regions.max} step="1" onChange={(n) => set({ regions: Math.round(n) })} />
        <NumberField id="t-p99" label="p99 target" unit="ms" value={traffic.p99TargetMs} min={LIMITS.p99.min} max={LIMITS.p99.max} onChange={(n) => set({ p99TargetMs: n })} />
      </div>
      <FromUsers onUse={(reads, writes) => set({ readsPerSecond: reads, writesPerSecond: writes })} />
      <div className="space-y-2 border-t border-rule-soft px-4 py-3 sm:px-5">
        {route("read")}
        {path("read") && <p className="pl-14 text-[0.75rem] text-ink-3 max-sm:pl-0">{path("read")}</p>}
        {route("write")}
        {path("write") && <p className="pl-14 text-[0.75rem] text-ink-3 max-sm:pl-0">{path("write")}</p>}
        {background.length > 0 && (
          <p className="text-[0.75rem] leading-relaxed text-ink-3">
            After each write, assumed once per write:{" "}
            {background.map((o) => o.path.map(label).join(" → ")).join("; ")}.
          </p>
        )}
        {traffic.regions > 1 && found.write && project.components.find((c) => c.id === found.write?.target)?.kind === "database" && (
          <p className="text-[0.75rem] leading-relaxed text-ink-3">
            Writes go to one primary region. From the other {traffic.regions - 1}, that adds a round trip of about{" "}
            {CROSS_REGION_MS} ms (assumed: roughly US east to west). Reads are served by a copy in each region.
          </p>
        )}
      </div>
    </section>
  );
}

/** Back-of-envelope: people and actions a day, turned into the averages above, with the arithmetic shown. */
function FromUsers({ onUse }: { onUse: (reads: number, writes: number) => void }) {
  const [people, setPeople] = useState(100_000);
  const [readsEach, setReadsEach] = useState(50);
  const [writesEach, setWritesEach] = useState(5);
  const reads = perSecondFromDaily(people, readsEach);
  const writes = perSecondFromDaily(people, writesEach);
  const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString("en-US") : n.toFixed(1));
  return (
    <details className="group border-t border-rule-soft px-4 py-2.5 sm:px-5">
      <summary className="cursor-pointer list-none text-[0.8125rem] text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="mr-1.5 inline-block font-mono text-ink-3 transition-transform group-open:rotate-90" aria-hidden="true">
          ›
        </span>
        Work the averages out from people a day
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-3 pb-1 sm:grid-cols-3">
        <NumberField id="u-people" label="People a day" value={people} min={0} max={10_000_000_000} onChange={setPeople} />
        <NumberField id="u-reads" label="Reads each, a day" value={readsEach} min={0} max={1_000_000} onChange={setReadsEach} />
        <NumberField id="u-writes" label="Writes each, a day" value={writesEach} min={0} max={1_000_000} onChange={setWritesEach} />
      </div>
      <p className="mt-2 font-mono text-[0.75rem] leading-relaxed text-ink-2">
        {people.toLocaleString("en-US")} × {readsEach.toLocaleString("en-US")} ÷ 86,400 s ≈ {fmt(reads)} reads/s
        <br />
        {people.toLocaleString("en-US")} × {writesEach.toLocaleString("en-US")} ÷ 86,400 s ≈ {fmt(writes)} writes/s
      </p>
      <p className="mt-1 text-[0.75rem] text-ink-3">
        That is the average over a whole day. Traffic bunches into waking hours, which is what the peak multiplier is for.
      </p>
      <button
        type="button"
        className="btn btn-secondary btn-sm mt-2"
        onClick={() => onUse(Number(reads.toFixed(2)), Number(writes.toFixed(2)))}
      >
        Use these averages
      </button>
    </details>
  );
}
