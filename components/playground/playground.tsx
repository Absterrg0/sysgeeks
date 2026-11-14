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
  Stuck,
  type Help,
  useScenarioProgress,
  type ScenarioSource,
} from "@/components/playground/scenario";
import { DotArrow } from "@/components/icons";
import { LiveCanvas } from "@/components/playground/live-canvas";
import {
  Coach,
  MissionList,
  Readouts,
  SystemPicker,
  Tabs,
  TrafficControl,
  formatMultiplier,
  useTour,
  type CoachStep,
} from "@/components/playground/workspace-parts";
import { useToast } from "@/components/feedback";
import { decodeDesign, encodeDesign, hasDesign } from "@/lib/client/design-link";
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
  systems = [],
  heading,
}: {
  investigation: { id: string; title: string; searchTitle: string };
  system: SystemInput;
  workload: Workload;
  concepts: Record<string, { title: string; summary: string }>;
  writeups: PlaygroundWriteup[];
  scenarios?: Scenario[];
  /** Every system with a playground, for the switcher. */
  systems?: { id: string; title: string; missions: number }[];
  /** On the home page: the page's own title, set above the workspace. */
  heading?: { title: string; lede: string };
}) {
  const reference = useMemo(() => playModelOf(system, baseWorkload), [system, baseWorkload]);
  const hash = useHash();
  const { id: scenarioId, fresh } = scenarioOf(hash);
  const scenario = scenarios.find((s) => s.id === scenarioId);
  const pickScenario = (id: string | null) => {
    setHash(id ? `scenario=${id}` : "");
    setSelected(null);
    setTab("requests");
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
  // Untouched, free play runs at peak; a first visit starts quiet, at average, so breaking it is the visitor's doing.
  const [freeTraffic, setFreeTraffic] = useState<number | null>(null);
  const tour = useTour();
  const workload = scenario ? scenarioWorkload(baseWorkload, scenario) : baseWorkload;
  const traffic = scenario ? scenario.traffic : (freeTraffic ?? (tour.step === 0 ? 1 : baseWorkload.peak));
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"debrief" | "requests" | "changes" | "compare" | "ai">("requests");

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

  // Remember a pass, so the list can mark it and Review can bring it back later.
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

  const trafficLabel = scenario
    ? `${scenario.title.toLowerCase()} traffic`
    : `${formatMultiplier(traffic)} average traffic`;

  // The part in the most trouble: where the tour points, and what "try this" leads with.
  // Parts a caller waits on come first: they are what turns into failed requests.
  const waitedOn = new Set(
    sim.operations
      .filter((o) => !o.background)
      .flatMap((o) => (o.handoff === undefined ? o.route : o.route.slice(0, o.handoff + 1))),
  );
  const struggling = model.components
    .filter((c) => c.role !== "client" && !ROLES[c.role].managed)
    .map((c) => ({ c, r: sim.components[c.id], front: waitedOn.has(c.id) }))
    .filter(({ r }) => r && (r.status === "over" || r.status === "down"))
    .sort((a, b) => Number(b.front) - Number(a.front) || (b.r?.utilization ?? 0) - (a.r?.utilization ?? 0))[0];

  // First visit: break it, find it, fix it. Each step ends when you have done it.
  const tourOn = tour.step !== null && !scenario;
  const finishTour = tour.finish;
  // A first visit starts quiet, at average traffic, so breaking it is the visitor's doing.
  // The tour moves on only once the visitor has moved the traffic themselves.
  const changeTraffic = (next: number) => setFreeTraffic(next);
  const [tourTarget, setTourTarget] = useState<string | null>(null);
  useEffect(() => {
    if (!tourOn) return;
    /* eslint-disable react-hooks/set-state-in-effect -- the tour advances on what the person did */
    if (tour.step === 0 && struggling && freeTraffic !== null) {
      setTourTarget(struggling.c.id);
      tour.setStep(1);
    } else if (tour.step === 1 && tourTarget && selected === tourTarget) {
      tour.setStep(2);
    } else if (tour.step === 2 && tourTarget && sim.components[tourTarget]?.status !== "over") {
      tour.finish();
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [tourOn, tour, struggling, tourTarget, selected, sim, freeTraffic]);
  const targetLabel = tourTarget ? labelOf(tourTarget) : "";
  const targetLoad = tourTarget ? percent(sim.components[tourTarget]?.utilization ?? 0) : "";
  const coachSteps: CoachStep[] = [
    {
      title: "Break it on purpose",
      body: "This dial is how many requests your users send. Drag it right until a part turns red.",
      action: { label: "Set it to 10×", run: () => changeTraffic(baseWorkload.peak * 10) },
    },
    {
      title: `${targetLabel} can't keep up`,
      body: `It is getting ${targetLoad} of what it can handle, so work piles up and requests fail. Click it.`,
      action: tourTarget ? { label: `Open ${targetLabel}`, run: () => setSelected(tourTarget) } : undefined,
    },
    {
      title: "Now fix it",
      body: "Add instances, or put a queue or cache in front. Watch p99 and failing in the bar come back down. Then take a mission.",
      action: { label: "Got it", run: tour.finish },
    },
  ];

  const coachStep = tour.step !== null ? coachSteps[tour.step] : undefined;
  const coach =
    tourOn && coachStep ? (
      <Coach index={tour.step ?? 0} total={coachSteps.length} step={coachStep} onSkip={tour.finish} />
    ) : null;
  const wide = useWide();
  const [drawer, setDrawer] = useState(false);
  // Beating a mission opens the debrief, once per mission.
  const [debriefShown, setDebriefShown] = useState<string | null>(null);
  useEffect(() => {
    if (!passed || !scenario || debriefShown === scenario.id) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reacting to the design passing */
    setDebriefShown(scenario.id);
    setTab("debrief");
    setDrawer(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [passed, scenario, debriefShown]);
  const activeTab = tab === "debrief" && !passed ? "requests" : tab;

  // Room the floating panels take over the canvas, so the system is fitted into what is left.
  const insets = wide
    ? { top: 104, left: 340, right: selectedPart ? 356 : 28, bottom: drawer ? 372 : 72 }
    : { top: 16, left: 16, right: 16, bottom: 16 };

  // A shared design arrives in the #fragment: open it as this browser's free-play design, then tidy the URL.
  const { toast } = useToast();
  useEffect(() => {
    if (!hasDesign(hash) || scenario) return;
    let live = true;
    void decodeDesign(hash).then((raw) => {
      if (!live) return;
      const shared = parseDraft(raw);
      setHash("");
      if (!shared) {
        toast({ message: "That design link could not be read.", tone: "error" });
        return;
      }
      store(shared);
      setSelected(null);
      // Someone sent a design to look at, not a tour to take.
      finishTour();
      toast({ message: "Opened a shared design. Reset goes back to the reference.", tone: "success" });
    });
    return () => {
      live = false;
    };
  }, [hash, scenario, store, toast, finishTour]);

  const share = async () => {
    const base = `${window.location.origin}/investigations/${investigation.id}/playground`;
    const fragment = scenario ? `scenario=${scenario.id}` : changed ? await encodeDesign({ v: DRAFT_VERSION, model }) : "";
    const url = fragment ? `${base}#${fragment}` : base;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        message: scenario ? "Mission link copied." : changed ? "Link to your design copied." : "Link copied.",
        tone: "success",
      });
    } catch {
      toast({ message: url, tone: "neutral" });
    }
  };

  const resetButton = (
    <button
      type="button"
      className="btn btn-ghost btn-sm shrink-0"
      disabled={!changed}
      onClick={() => {
        discard();
        setSelected(null);
      }}
    >
      {scenario ? "Start over" : "Reset"}
    </button>
  );

  const missionView =
    scenario && check ? (
      <div>
        <button
          type="button"
          onClick={() => pickScenario(null)}
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-ink-3 transition-colors hover:text-ink"
        >
          <span aria-hidden="true">←</span> All missions
        </button>
        <p className="kicker mt-4">
          Mission {scenarios.indexOf(scenario) + 1} of {scenarios.length}
        </p>
        <h2 className="mt-1 text-[1.125rem] leading-snug font-semibold tracking-[-0.025em]">{scenario.title}</h2>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-2">{scenario.situation}</p>
        <GoalPlate
          check={check}
          scenario={scenario}
          opLabel={opLabel}
          labelOf={labelOf}
          isDatabase={isDatabase}
          onPick={setSelected}
        />
        {check.passed ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-[12px] bg-signal-strong-soft px-3.5 py-3">
            <p className="text-[0.8125rem] leading-snug font-medium text-signal-strong">Mission beaten.</p>
            <button
              type="button"
              className="btn btn-accent btn-sm group"
              onClick={() => {
                setTab("debrief");
                setDrawer(true);
              }}
            >
              Debrief
              <DotArrow />
            </button>
          </div>
        ) : (
          <div className="mt-5">
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
          </div>
        )}
      </div>
    ) : null;

  const tabs: { id: typeof tab; label: string; badge?: string }[] = [
    ...(passed ? [{ id: "debrief" as const, label: "Debrief" }] : []),
    { id: "requests", label: "Requests" },
    { id: "changes", label: "What changed", badge: insights.changes.length ? String(insights.changes.length) : undefined },
    { id: "compare", label: "Compare designs" },
    { id: "ai", label: "Ask AI" },
  ];

  const details = (
    <div className="pg-tab">
      {activeTab === "debrief" && scenario && check?.passed && (
        <div className="grid gap-x-10 xl:grid-cols-2">
          <Debrief scenario={scenario} sources={sources} concepts={concepts} next={nextScenario} onNext={pickScenario} />
          <DefendPanel
            key={scenario.id}
            model={check.model}
            workload={check.workload}
            traffic={scenario.traffic}
            onPick={setSelected}
            intro="It holds. Now the interviewer follows up about your design, in this situation. Say what you expect, then see what the model says."
          />
        </div>
      )}
      {activeTab === "requests" && <Operations sim={sim} referenceSim={referenceSim} labelOf={labelOf} />}
      {activeTab === "changes" && (
        <Insights
          insights={insights}
          concepts={concepts}
          writeups={writeups}
          onPick={setSelected}
          baseline={scenario ? "the scenario's starting design" : "the reference design"}
        />
      )}
      {activeTab === "compare" && (
        <ComparePanel
          key={scenario?.id ?? "free"}
          storageKey={scenario ? `playground-compare:${investigation.id}:${scenario.id}` : `playground-compare:${investigation.id}`}
          model={model}
          workload={workload}
          traffic={traffic}
          prepare={
            scenario ? (m) => checkScenario({ model: m, reference, workload: baseWorkload, scenario }).model : undefined
          }
          trafficLabel={trafficLabel}
          onRestore={(m) => {
            setModel(m);
            setSelected(null);
          }}
        />
      )}
      {activeTab === "ai" && (
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
      )}
    </div>
  );

  return (
    <div className="pg-app relative left-1/2 w-[100cqw] -translate-x-1/2">
      {!heading && <h1 className="sr-only">{investigation.searchTitle}: system design playground</h1>}
      <div className="pg-stage relative mt-2 flex flex-col gap-3 px-3 pb-4 sm:px-4 lg:mt-0 lg:block lg:h-[calc(100dvh-4.5rem)] lg:min-h-[38rem] lg:p-0">
        {/* The system, running, across the whole stage. */}
        <div className="relative order-2 lg:pg-canvas lg:absolute lg:inset-0">
          <LiveCanvas
            model={model}
            sim={sim}
            selectedId={selected}
            onSelect={setSelected}
            highlight={tourOn && tour.step === 1 && tourTarget ? [tourTarget] : undefined}
            label={`${investigation.title}, running at ${trafficLabel}`}
            fill={wide ? insets : undefined}
          />
          <p
            className={`pointer-events-none absolute right-5 bottom-4 hidden max-w-[36ch] text-right font-mono text-[0.6875rem] leading-relaxed text-ink-3 ${drawer || selectedPart ? "" : "lg:block"}`}
          >
            {scenario ? `${formatMultiplier(scenario.traffic)} average traffic` : workload.note}
          </p>
        </div>

        {/* Traffic and the numbers to watch, floating over the top of the canvas. */}
        <div
          className={`order-1 lg:absolute lg:top-3 lg:left-[21.25rem] lg:flex lg:justify-center ${selectedPart ? "lg:right-[22.25rem]" : "lg:right-4"}`}
        >
          <div className="pg-panel flex w-full flex-col gap-1 p-1.5 sm:flex-row sm:items-center lg:max-w-[56rem]">
            <TrafficControl
              workload={baseWorkload}
              traffic={traffic}
              onChange={changeTraffic}
              locked={scenario ? `Mission traffic · ${formatMultiplier(scenario.traffic)} avg` : undefined}
              pulse={tourOn && tour.step === 0}
            />
            <div className="hidden h-10 w-px bg-rule sm:block" aria-hidden="true" />
            <div className="flex items-center justify-between gap-1 overflow-x-auto pr-1">
              <Readouts sim={sim} was={changed ? referenceSim : undefined} />
              <div className="flex shrink-0 flex-col items-stretch gap-0.5">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void share()}>
                  Share
                </button>
                {resetButton}
              </div>
            </div>
          </div>
        </div>

        {/* Left: which system, the mission, and what to try. */}
        <aside
          aria-label="Missions"
          className="max-lg:contents lg:pg-panel lg:absolute lg:top-3 lg:bottom-4 lg:left-4 lg:flex lg:min-h-0 lg:w-[20rem] lg:flex-col"
        >
          <div className="order-0 lg:border-b lg:border-rule-soft lg:p-2">
            {heading && (
              <div className="px-1 pt-4 pb-3 lg:px-2.5 lg:pt-2">
                <h1 className="text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.035em] text-balance lg:text-[1.0625rem] lg:leading-snug lg:tracking-[-0.025em]">
                  {heading.title}
                </h1>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-2 lg:mt-1 lg:text-[0.8125rem] lg:text-ink-3">{heading.lede}</p>
              </div>
            )}
            <SystemPicker current={{ id: investigation.id, title: investigation.title }} systems={systems} />
          </div>
          <div className="order-3 min-h-0 flex-1 max-lg:mt-2 lg:overflow-y-auto lg:p-4 [scrollbar-width:thin]">
            {coach && <div className="mb-5">{coach}</div>}
            {missionView ?? (
              <div className="space-y-7">
                {scenarios.length > 0 && (
                  <MissionList
                    investigationId={investigation.id}
                    scenarios={scenarios}
                    progress={progress}
                    onPick={pickScenario}
                  />
                )}
                <Ideas
                  model={model}
                  sim={sim}
                  onPick={setSelected}
                  onTraffic={() => changeTraffic(baseWorkload.peak * 10)}
                />
              </div>
            )}
          </div>
          <div className="order-3 flex items-center gap-1 lg:border-t lg:border-rule-soft lg:p-2">
            <Link href={`/investigations/${investigation.id}`} className="btn btn-ghost btn-sm flex-1">
              Learn it
            </Link>
            <Link href={`/investigations/${investigation.id}/review`} className="btn btn-ghost btn-sm flex-1">
              Worked answer
            </Link>
          </div>
        </aside>

        {/* Right: the part you picked. */}
        {selectedPart && (
          <aside
            aria-label="The selected part"
            className="pg-panel order-2 overflow-y-auto lg:absolute lg:top-3 lg:right-4 lg:bottom-4 lg:w-[20.5rem]"
          >
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
              bare
            />
          </aside>
        )}

        {/* Bottom: the detail, in a drawer over the canvas. */}
        <div
          className={`order-4 lg:absolute lg:bottom-4 lg:left-[21.25rem] ${selectedPart ? "lg:right-[22.25rem]" : "lg:right-4"} ${
            drawer ? "lg:top-auto" : ""
          }`}
        >
          {wide && !drawer ? (
            <div className="flex justify-center">
              <div className="pg-panel flex items-center gap-1 p-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTab(t.id);
                      setDrawer(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[0.8125rem] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink"
                  >
                    {t.label}
                    {t.badge && <span className="font-mono text-[0.6875rem] text-ink-3">{t.badge}</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={wide ? "pg-panel flex h-[22rem] flex-col" : ""}>
              <div className={`flex items-center gap-3 ${wide ? "px-4 pt-2" : "mt-4"}`}>
                <div className="min-w-0 flex-1">
                  <Tabs tabs={tabs} active={activeTab} onChange={setTab} />
                </div>
                {wide && (
                  <button type="button" className="knob size-8 shrink-0" aria-label="Close details" onClick={() => setDrawer(false)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                      <path d="M3.5 5.5l3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
              <div className={wide ? "min-h-0 flex-1 overflow-y-auto px-4 pb-4" : ""}>{details}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Wide enough for the floating workspace; below this the panels stack under the canvas. */
function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
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
    <section aria-labelledby="operations" className="mt-10">
      <h2 id="operations" className="text-[15px] font-semibold tracking-[-0.01em]">
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
                      <span className="ml-2 font-mono text-[0.6875rem] font-normal text-ink-3">background</span>
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
    <section className="mt-10">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-[0.875rem] text-ink-3">{empty}</p>
      ) : (
        <ul className="plate mt-3">
          {items.map((insight) => {
            const source = sourceFor(insight);
            return (
              <li key={insight.id} className="plate-row px-4 py-3 sm:px-5">
                <div className="flex items-start gap-3">
                  <span className={`led ${TONE_LED[insight.tone]} mt-[0.45rem]`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.875rem] font-medium leading-snug">
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
                    <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">{insight.detail}</p>
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
      <div className="inline-flex items-center gap-1 rounded-[10px] bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] p-[3px] shadow-[inset_0_0_0_1px_var(--edge)]">
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
  bare,
}: {
  model: PlayModel;
  sim: Simulation;
  id: string;
  /** Inside a panel already: no surface of its own. */
  bare?: boolean;
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
          : "bg-ink";

  return (
    <div className={bare ? "p-4" : "panel p-4 sm:p-5"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker">
            {part.added ? `Added · ${part.role === "limiter" ? "rate limiter" : part.kind}` : part.kind}
          </p>
          <h2 className="mt-1.5 text-[1.0625rem] leading-tight font-semibold tracking-[-0.02em]">{part.label}</h2>
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
            className="mt-2 w-full accent-[var(--ink)] disabled:opacity-50"
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

      {parts.length > 0 && (
        <div className="mt-5">
          <p className="kicker">Put in front of it</p>
          <ul className="mt-1.5 -mx-2">
            {parts.map((p: Part) => (
              <li key={p}>
                <button
                  type="button"
                  className="group flex w-full items-start gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-hover"
                  onClick={() => {
                    const next = insertInFront(model, id, p);
                    onChange(next);
                    const added = next.components.find((c) => c.added && !model.components.some((m) => m.id === c.id));
                    if (added) onInserted(added.id);
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="mt-px grid size-5 shrink-0 place-items-center rounded-[6px] bg-raised text-[0.8125rem] leading-none text-ink-2 shadow-[var(--shadow-key)] group-hover:text-ink"
                  >
                    +
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.8125rem] font-medium">{PART_INFO[p].label}</span>
                    <span className="block text-[0.75rem] leading-snug text-ink-3">{PART_INFO[p].responsibility}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {part.role !== "client" && (
        <div className="mt-5">
          <p className="kicker">Break it</p>
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

  const row =
    "group flex w-full items-start gap-3 py-2.5 text-left text-[0.8125rem] leading-snug text-ink-2 transition-colors hover:text-ink";
  const check = (
    <i
      aria-hidden="true"
      className="mt-[0.2rem] size-3 shrink-0 rounded-full shadow-[inset_0_0_0_1px_var(--rule-strong)] transition-shadow group-hover:shadow-[inset_0_0_0_3.5px_var(--ink)]"
    />
  );
  return (
    <div className="lg:pt-1">
      <p className="kicker">try this</p>
      <ul className="mt-2 divide-y divide-rule-soft border-y border-rule-soft">
        {ideas.map((idea) => (
          <li key={idea.text}>
            <button type="button" className={row} onClick={() => onPick(idea.id)}>
              {check}
              {idea.text}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={row} onClick={onTraffic}>
            {check}
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
