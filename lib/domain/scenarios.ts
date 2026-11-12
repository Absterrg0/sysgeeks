/**
 * Scenarios: a situation to get a system through in the playground. Each one sets the traffic, may break
 * something, and states what has to hold (requests served, a wait, a budget, surviving a failure). The check
 * is the playground's own deterministic model, run on every edit: the same design always gets the same
 * verdict, at once, with the numbers that decided it.
 *
 * Passing is not the point; the debrief is. It says what the change cost, how the engineers who built the
 * real system handled it, and what the model leaves out.
 *
 * Pure and client-safe.
 */
import {
  ROLES,
  insertInFront,
  removePart,
  simulate,
  tune,
  type Part,
  type PlayModel,
  type Simulation,
  type Tuning,
  type Workload,
} from "./playground";

/** Something that goes wrong, applied on top of whatever design is being checked. */
export type Fault =
  /** One instance dies; for a database, one primary. Or every node of it. */
  | { kind: "kill"; componentId: string; count: "one" | "all" }
  /** A cache or CDN restarts empty and answers nothing until it refills. */
  | { kind: "cold"; componentId: string }
  /** It answers this many times slower. */
  | { kind: "slow"; componentId: string; factor: number };

export type Goal =
  /** At most this share of the operations' requests fail; under `when`, with that fault added. */
  | { kind: "served"; ops: string[]; maxFailing: number; when?: Fault }
  /** A caller of the operation waits at most this long, on average. */
  | { kind: "wait"; op: string; maxMs: number }
  /** Background work is done as fast as it arrives. */
  | { kind: "keeps-up"; ops: string[] }
  /** Instances paid for, killed or not; managed services are not counted. */
  | { kind: "budget"; maxInstances: number };

/** One change to a design, as a person would make it in the playground. */
export type Edit =
  | { insert: Part; before: string; set?: Partial<Tuning> }
  | { tune: string; set: Partial<Tuning> }
  | { remove: string };

export type ScenarioDebrief = {
  /** What the change bought costs, in money, complexity or correctness. */
  cost: string;
  /** How the engineers who built the real system dealt with it, from the sources. */
  realWorld: string;
  /** Writeups (`lib/content/sources.ts`) that back `realWorld`. */
  sourceIds: string[];
  conceptIds: string[];
  /** The point, said the way you would say it in an interview. */
  interview: string;
  /** What the model leaves out, so nobody mistakes it for the real thing. */
  limits: string;
};

export type Scenario = {
  id: string;
  investigationId: string;
  title: string;
  /** One line, for lists. */
  summary: string;
  /** What is happening, in two or three sentences. */
  situation: string;
  /** Traffic as a multiple of the average. */
  traffic: number;
  /** Extra multipliers for some operations: what this situation sends more of. */
  surge?: Record<string, number>;
  /** Changes to the reference design that make the starting design. */
  start?: Edit[];
  /** Already happening; applied to every design checked. */
  faults?: Fault[];
  /** Settings this situation decides, not the person playing. Checked at the starting design's values. */
  frozen?: { componentId: string; field: "hitRate" | "limit"; why: string }[];
  goals: Goal[];
  /** From a nudge to a pointer at the part; the parts are highlighted. */
  hints: { text: string; componentIds?: string[] }[];
  debrief: ScenarioDebrief;
  /** One answer that passes, checked by the tests and shown on request. */
  solution: Edit[];
};

// ---------------------------------------------------------------------------
// Building the designs a scenario checks
// ---------------------------------------------------------------------------

/** Applies edits in order. An insert's `set` goes to the part it put in. */
export function applyEdits(model: PlayModel, edits: Edit[]): PlayModel {
  let next = model;
  for (const edit of edits) {
    if ("insert" in edit) {
      const before = new Set(next.components.map((c) => c.id));
      next = insertInFront(next, edit.before, edit.insert);
      const added = next.components.find((c) => !before.has(c.id));
      if (added && edit.set) next = tune(next, added.id, edit.set);
    } else if ("tune" in edit) {
      next = tune(next, edit.tune, edit.set);
    } else {
      next = removePart(next, edit.remove);
    }
  }
  return next;
}

export function startOf(reference: PlayModel, scenario: Scenario): PlayModel {
  return applyEdits(reference, scenario.start ?? []);
}

/** The workload this situation sends. */
export function scenarioWorkload(workload: Workload, scenario: Scenario): Workload {
  if (!scenario.surge) return workload;
  return {
    ...workload,
    operations: workload.operations.map((op) => {
      const factor = scenario.surge?.[op.id];
      return factor ? { ...op, rps: op.rps * factor } : op;
    }),
  };
}

/** Breaks the design the way the fault says. A fault on a part that is no longer there does nothing. */
export function injectFault(model: PlayModel, fault: Fault): PlayModel {
  const part = model.components.find((c) => c.id === fault.componentId);
  const t = model.tuning[fault.componentId];
  if (!part || !t) return model;
  switch (fault.kind) {
    case "kill":
      return fault.count === "all"
        ? tune(model, part.id, { down: t.instances, outage: true })
        : tune(model, part.id, { down: t.down + 1 });
    case "cold":
      return tune(model, part.id, { hitRate: 0 });
    case "slow":
      return tune(model, part.id, { slow: Math.max(t.slow ?? 1, fault.factor) });
  }
}

/** Settings the situation decides go back to the starting design's values, whatever was saved. */
export function withFrozen(model: PlayModel, start: PlayModel, scenario: Scenario): PlayModel {
  let next = model;
  for (const { componentId, field } of scenario.frozen ?? []) {
    const value = start.tuning[componentId]?.[field];
    if (value !== undefined && next.tuning[componentId]) next = tune(next, componentId, { [field]: value });
  }
  return next;
}

/** Instances paid for: killed ones still cost money. Parts a provider runs are not counted. */
export function provisioned(model: PlayModel): number {
  return model.components.reduce((sum, c) => {
    if (ROLES[c.role].managed) return sum;
    const t = model.tuning[c.id];
    if (!t) return sum;
    return sum + (c.role === "database" ? t.instances * (1 + t.replicas) : t.instances);
  }, 0);
}

// ---------------------------------------------------------------------------
// Checking
// ---------------------------------------------------------------------------

export type GoalResult = {
  goal: Goal;
  met: boolean;
  /** What was measured, formatted, e.g. "0.4%" or "212 ms". */
  actual: string;
  /** The target, formatted, e.g. "≤ 0.1%". */
  target: string;
  /** Which operations or parts decided it, for highlighting. */
  componentIds: string[];
};

export type ScenarioCheck = {
  /** The design as checked: frozen settings restored and the situation's faults applied. */
  model: PlayModel;
  workload: Workload;
  sim: Simulation;
  goals: GoalResult[];
  passed: boolean;
};

const share = (n: number) => {
  if (n <= 0) return "0%";
  if (n < 0.001) return "<0.1%";
  return `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;
};
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`);

function failingShare(sim: Simulation, ops: string[]): { share: number; blockers: string[] } {
  let offered = 0;
  let failed = 0;
  const blockers: string[] = [];
  for (const id of ops) {
    const o = sim.operations.find((op) => op.id === id);
    if (!o) continue;
    offered += o.offered;
    failed += o.failed;
    if (o.blockedBy) blockers.push(o.blockedBy);
  }
  return { share: offered > 0 ? failed / offered : 0, blockers };
}

/** Where the trouble is in a simulation: parts that are down, over capacity or losing data. */
function troubleIn(sim: Simulation): string[] {
  return Object.entries(sim.components)
    .filter(([, r]) => r.status === "down" || r.status === "over" || r.lost > 0)
    .map(([id]) => id);
}

export function checkScenario(input: {
  model: PlayModel;
  reference: PlayModel;
  workload: Workload;
  scenario: Scenario;
}): ScenarioCheck {
  const { scenario } = input;
  const start = startOf(input.reference, scenario);
  const workload = scenarioWorkload(input.workload, scenario);
  const design = withFrozen(input.model, start, scenario);
  const live = (scenario.faults ?? []).reduce(injectFault, design);
  const sim = simulate(live, workload, scenario.traffic);

  const goals = scenario.goals.map((goal): GoalResult => {
    switch (goal.kind) {
      case "served": {
        const under = goal.when ? simulate(injectFault(live, goal.when), workload, scenario.traffic) : sim;
        const { share: failing, blockers } = failingShare(under, goal.ops);
        return {
          goal,
          met: failing <= goal.maxFailing + 1e-9,
          actual: share(failing),
          target: `≤ ${share(goal.maxFailing)}`,
          componentIds: [...new Set([...blockers, ...troubleIn(under)])],
        };
      }
      case "wait": {
        const o = sim.operations.find((op) => op.id === goal.op);
        const reachable = Boolean(o?.reachable);
        const wait = o?.latencyMs ?? 0;
        return {
          goal,
          met: reachable && wait <= goal.maxMs,
          actual: reachable ? ms(wait) : "cut off",
          target: `≤ ${ms(goal.maxMs)}`,
          componentIds: o
            ? o.route.filter((id) => (sim.components[id]?.utilization ?? 0) >= 0.7 || o.blockedBy === id)
            : [],
        };
      }
      case "keeps-up": {
        let offered = 0;
        let backlog = 0;
        for (const id of goal.ops) {
          const o = sim.operations.find((op) => op.id === id);
          if (!o) continue;
          offered += o.offered;
          backlog += o.backlog;
        }
        const behind = offered > 0 ? backlog / offered : 0;
        return {
          goal,
          met: behind <= 0.01,
          actual: behind <= 0.01 ? "keeping up" : `${share(behind)} behind`,
          target: "keeps up",
          componentIds: troubleIn(sim),
        };
      }
      case "budget": {
        const count = provisioned(design);
        return {
          goal,
          met: count <= goal.maxInstances,
          actual: count.toLocaleString("en-US"),
          target: `≤ ${goal.maxInstances.toLocaleString("en-US")}`,
          componentIds: [],
        };
      }
    }
  });
  return { model: live, workload, sim, goals, passed: goals.every((g) => g.met) };
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export function describeFault(fault: Fault, labelOf: (id: string) => string, isDatabase: (id: string) => boolean) {
  const name = labelOf(fault.componentId);
  switch (fault.kind) {
    case "kill":
      if (fault.count === "all") return `${name} goes down entirely`;
      return isDatabase(fault.componentId) ? `a ${name} primary dies` : `one ${name} instance dies`;
    case "cold":
      return `${name} restarts empty`;
    case "slow":
      return `${name} gets ${fault.factor}× slower`;
  }
}

/** A goal in a few words: "Redirects and New links fail ≤ 0.1%". */
export function describeGoal(
  goal: Goal,
  opLabel: (id: string) => string,
  labelOf: (id: string) => string,
  isDatabase: (id: string) => boolean,
): string {
  const ops = (ids: string[]) => {
    const labels = ids.map(opLabel);
    return labels.length <= 1 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
  };
  switch (goal.kind) {
    case "served": {
      const what = `${ops(goal.ops)} failing`;
      if (!goal.when) return what;
      const when = describeFault(goal.when, labelOf, isDatabase);
      return `If ${when}: ${what.charAt(0).toLowerCase()}${what.slice(1)}`;
    }
    case "wait":
      return `${opLabel(goal.op)}: time a caller waits`;
    case "keeps-up":
      return `${ops(goal.ops)} keep up`;
    case "budget":
      return "Instances you pay for";
  }
}

// ---------------------------------------------------------------------------
// Coming back
// ---------------------------------------------------------------------------

/** What the browser keeps about a scenario: when it was first solved, or opened with the answer shown. */
export type ScenarioRecord = {
  solvedAt?: string;
  /** Solved again after the first time, most recent last; at most a few kept. */
  resolvedAt?: string[];
  /** The answer was shown before it was solved. */
  revealedAt?: string;
};

export type ScenarioProgress = Record<string, ScenarioRecord>;

export const scenarioKey = (investigationId: string, scenarioId: string) => `${investigationId}/${scenarioId}`;

/** Days until a solved scenario is worth solving again from scratch: 3, then 10, then 30. */
const SPACING = [3, 10, 30];

/** When a solved scenario is due to be solved again from scratch, or undefined when it is not solved. */
export function scenarioDueAt(record: ScenarioRecord | undefined): Date | undefined {
  if (!record?.solvedAt) return undefined;
  const solves = [record.solvedAt, ...(record.resolvedAt ?? [])];
  const last = solves.at(-1) as string;
  const days = SPACING[Math.min(solves.length - 1, SPACING.length - 1)] as number;
  return new Date(new Date(last).getTime() + days * 86_400_000);
}

/** Records a pass. The first sets `solvedAt`; later ones, at least a day apart, count as a review. */
export function recordSolve(progress: ScenarioProgress, key: string, now: string): ScenarioProgress {
  const record = progress[key] ?? {};
  if (!record.solvedAt) return { ...progress, [key]: { ...record, solvedAt: now } };
  const due = scenarioDueAt(record);
  if (!due || new Date(now).getTime() < due.getTime()) return progress;
  const resolvedAt = [...(record.resolvedAt ?? []), now].slice(-4);
  return { ...progress, [key]: { ...record, resolvedAt } };
}

export function recordReveal(progress: ScenarioProgress, key: string, now: string): ScenarioProgress {
  const record = progress[key] ?? {};
  if (record.revealedAt || record.solvedAt) return progress;
  return { ...progress, [key]: { ...record, revealedAt: now } };
}

/** Reads stored progress, keeping only well-formed records. */
export function parseScenarioProgress(raw: unknown): ScenarioProgress | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const isDate = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
  const out: ScenarioProgress = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(key) || !value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const record: ScenarioRecord = {};
    if (isDate(v.solvedAt)) record.solvedAt = v.solvedAt;
    if (Array.isArray(v.resolvedAt)) record.resolvedAt = v.resolvedAt.filter(isDate).slice(-4);
    if (isDate(v.revealedAt)) record.revealedAt = v.revealedAt;
    if (record.solvedAt || record.revealedAt) out[key] = record;
  }
  return out;
}
