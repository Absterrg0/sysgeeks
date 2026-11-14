/**
 * Missions: situations every playground system can be put through, generated from its workload rather than
 * written by hand. Each one starts failing on the reference design and comes with an answer found by a small
 * greedy solver, so a mission is only offered when the model itself shows it can be solved.
 *
 * Pure and client-safe, like the model it drives.
 */
import { formatRate, percent } from "./playground-insights";
import { ROLES, simulate, type PlayComponent, type PlayModel, type Simulation, type Tuning, type Workload } from "./playground";
import {
  applyEdits,
  checkScenario,
  injectFault,
  provisioned,
  startOf,
  type Edit,
  type Fault,
  type Goal,
  type Scenario,
} from "./scenarios";

/** The busiest a part is left when the solver is done: room for a spike, as you would size it for real. */
const HEADROOM = 0.8;
/** Steps the solver may take before it gives up on a situation. */
const MAX_STEPS = 80;

/** A writeup that can be pointed at from a debrief. */
export type MissionWriteup = { id: string; title: string; company: string };

type Situation = Pick<Scenario, "traffic" | "surge" | "faults" | "goals" | "frozen" | "start">;

/** A scenario shell around a situation, enough for `checkScenario`. */
function shell(situation: Situation): Scenario {
  return {
    id: "solve",
    investigationId: "",
    title: "",
    summary: "",
    situation: "",
    hints: [],
    debrief: { cost: "", realWorld: "", sourceIds: [], conceptIds: [], interview: "", limits: "" },
    solution: [],
    ...situation,
  };
}

/** Designs the situation's goals are measured on: as running, and once more for each `when` fault. */
function simsOf(model: PlayModel, reference: PlayModel, workload: Workload, scenario: Scenario): Simulation[] {
  const check = checkScenario({ model, reference, workload, scenario });
  const sims = [check.sim];
  for (const goal of scenario.goals) {
    if (goal.kind === "served" && goal.when) {
      sims.push(simulate(injectFault(check.model, goal.when), check.workload, scenario.traffic));
    }
  }
  return sims;
}

/** Parts whose state can decide the goals: the routes of the operations they name, as far as each goal looks. */
function relevantParts(sim: Simulation, scenario: Scenario): Set<string> {
  const ids = new Set<string>();
  for (const goal of scenario.goals) {
    if (goal.kind === "budget") continue;
    const ops = goal.kind === "wait" ? [goal.op] : goal.ops;
    for (const id of ops) {
      const o = sim.operations.find((op) => op.id === id);
      if (!o) continue;
      const route =
        goal.kind === "served"
          ? o.route.slice(0, o.handoff === undefined ? o.route.length : o.handoff + 1)
          : goal.kind === "keeps-up"
            ? o.route.slice(o.handoff ?? 0)
            : o.route;
      for (const part of route) ids.add(part);
      if (o.blockedBy) ids.add(o.blockedBy);
    }
    if (goal.kind === "served" && goal.when) ids.add(goal.when.componentId);
  }
  return ids;
}

/** How far a part is from healthy across the designs measured: utilisation, lost data, or being down. */
function badness(id: string, sims: Simulation[]): number {
  let worst = 0;
  for (const sim of sims) {
    const r = sim.components[id];
    if (!r) continue;
    if (r.status === "down" && r.reads + r.writes === 0) worst = Math.max(worst, 10);
    if (r.lost > 0) worst = Math.max(worst, 5 + r.lost);
    worst = Math.max(worst, r.utilization);
  }
  return worst;
}

function candidates(c: PlayComponent, t: Tuning, sims: Simulation[]): Partial<Tuning>[] {
  const util = Math.max(0, ...sims.map((s) => s.components[c.id]?.utilization ?? 0));
  const grow = (n: number) => Math.max(n + 1, Math.ceil((n * util) / HEADROOM));
  if (c.role === "database") {
    return [
      { instances: grow(t.instances) },
      { instances: t.instances + 1 },
      { replicas: t.replicas + 1 },
    ];
  }
  return [{ instances: grow(t.instances) }, { instances: t.instances + 1 }];
}

const addedBy = (c: PlayComponent, t: Tuning, patch: Partial<Tuning>) => {
  const next = { ...t, ...patch };
  return c.role === "database"
    ? next.instances * (1 + next.replicas) - t.instances * (1 + t.replicas)
    : next.instances - t.instances;
};

export type Solve = {
  /** Edits that take the starting design to one that passes, one per part changed. */
  edits: Edit[];
  model: PlayModel;
  /** Parts in the order the solver first had to change them: the first one is the first bottleneck. */
  order: string[];
};

/**
 * Greedily sizes a design until the situation's goals (other than a budget) pass and no part is left over
 * `HEADROOM` busy: each step takes the part in the worst state and tries more copies of it, keeping the
 * change that helps it most for the fewest machines. Only ever adds instances, shards and replicas.
 * Returns null when it cannot get there.
 */
export function solveFor(reference: PlayModel, workload: Workload, situation: Situation): Solve | null {
  const scenario = shell({ ...situation, goals: situation.goals.filter((g) => g.kind !== "budget") });
  const start = startOf(reference, scenario);
  const frozen = new Set((scenario.frozen ?? []).map((f) => f.componentId));
  let model = start;
  const order: string[] = [];
  for (let step = 0; step < MAX_STEPS; step++) {
    const check = checkScenario({ model, reference, workload, scenario });
    const sims = simsOf(model, reference, workload, scenario);
    const relevant = relevantParts(sims[0] as Simulation, scenario);
    const parts = model.components
      .filter((c) => relevant.has(c.id))
      .filter((c) => c.role !== "client" && !(ROLES[c.role].managed && c.role !== "lb") && !frozen.has(c.id))
      .map((c) => ({ c, bad: badness(c.id, sims) }))
      .filter(({ bad }) => bad > HEADROOM + 1e-9)
      .sort((a, b) => b.bad - a.bad);
    const worst = parts[0];
    if (!worst) return check.passed ? finish(start, model, order) : null;
    const { c } = worst;
    const t = model.tuning[c.id];
    if (!t) return null;
    let best: { model: PlayModel; bad: number; cost: number } | undefined;
    for (const patch of candidates(c, t, sims)) {
      const next = applyEdits(model, [{ tune: c.id, set: patch }]);
      const bad = badness(c.id, simsOf(next, reference, workload, scenario));
      const cost = addedBy(c, t, patch);
      // Fixing it outright beats helping it; among fixes, fewer machines win; otherwise, most help per machine.
      const score = (x: { bad: number; cost: number }) => (x.bad <= HEADROOM ? x.cost : 1e6 + x.bad * 1e3 + x.cost);
      if (!best || score({ bad, cost }) < score(best)) best = { model: next, bad, cost };
    }
    if (!best || best.bad >= worst.bad - 1e-9) return null;
    model = best.model;
    if (!order.includes(c.id)) order.push(c.id);
  }
  return null;
}

function finish(start: PlayModel, model: PlayModel, order: string[]): Solve {
  const edits: Edit[] = [];
  for (const id of order) {
    const before = start.tuning[id];
    const after = model.tuning[id];
    if (!before || !after) continue;
    const set: Partial<Tuning> = {};
    if (after.instances !== before.instances) set.instances = after.instances;
    if (after.replicas !== before.replicas) set.replicas = after.replicas;
    if (Object.keys(set).length > 0) edits.push({ tune: id, set });
  }
  return { edits, model, order };
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "about 193k redirects a second", "about 40 checkout requests a minute". */
function amountOf(perSecond: number, label: string): string {
  const rate = formatRate(perSecond);
  const unit = rate.match(/\/(s|min|h|day)$/)?.[1] ?? "s";
  const word = { s: "a second", min: "a minute", h: "an hour", day: "a day" }[unit];
  return `about ${rate.replace(/\/(s|min|h|day)$/, "")} ${lower(label)} ${word}`;
}

/** "about 90% of what it can handle", "about 19 times what it can handle". */
function loadOf(utilization: number): string {
  return utilization >= 2
    ? `about ${Math.round(utilization)} times what it can handle`
    : `about ${percent(utilization)} of what it can handle`;
}
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** "Redirect service from 1 to 9 instances", "Postgres from 1 to 4 shards and 1 replica each". */
function describeChange(c: PlayComponent, before: Tuning, after: Tuning): string {
  if (c.role === "database") {
    const shards = after.instances !== before.instances;
    const replicas = after.replicas !== before.replicas;
    if (shards && replicas)
      return `${c.label} from ${before.instances} to ${plural(after.instances, "shard")} with ${plural(after.replicas, "replica")} each`;
    if (shards) return `${c.label} from ${before.instances} to ${plural(after.instances, "shard")}`;
    return `${c.label} from ${before.replicas} to ${plural(after.replicas, "replica")} per shard`;
  }
  return `${c.label} from ${before.instances} to ${plural(after.instances, "instance")}`;
}

function conceptsFor(solve: Solve, start: PlayModel, extra: string[]): string[] {
  const ids = new Set(extra);
  for (const id of solve.order) {
    const c = solve.model.components.find((x) => x.id === id);
    const before = start.tuning[id];
    const after = solve.model.tuning[id];
    if (!c || !before || !after) continue;
    if (c.role === "database" && after.instances > before.instances) ids.add("partitioning");
    if (c.role === "database" && after.replicas > before.replicas) ids.add("replication");
    if (c.role === "worker" || c.role === "queue") ids.add("asynchronous-processing");
    if (c.role === "cache") ids.add("caching");
  }
  if (ids.size === 0) ids.add("backpressure");
  return [...ids].slice(0, 3);
}

function realWorldFor(writeups: MissionWriteup[], fallback: string): { realWorld: string; sourceIds: string[] } {
  const w = writeups[0];
  if (!w) return { realWorld: fallback, sourceIds: [] };
  return {
    realWorld: `${fallback} For how a team that runs one in production approached it, read ${w.company}'s “${w.title}” and compare what they changed with what you changed here.`,
    sourceIds: [w.id],
  };
}

// ---------------------------------------------------------------------------
// The missions
// ---------------------------------------------------------------------------

const GROWTH = [
  { factor: 10, id: "ten-x", title: "Ten times the traffic", word: "ten" },
  { factor: 5, id: "five-x", title: "Five times the traffic", word: "five" },
  { factor: 3, id: "three-x", title: "Three times the traffic", word: "three" },
] as const;

function passes(reference: PlayModel, workload: Workload, scenario: Scenario, edits: Edit[]): boolean {
  const model = applyEdits(startOf(reference, scenario), edits);
  return checkScenario({ model, reference, workload, scenario }).passed;
}

function opsOf(workload: Workload) {
  const foreground = workload.operations.filter((o) => !o.background);
  const background = workload.operations.filter((o) => o.background);
  const lead = [...foreground].sort((a, b) => b.rps - a.rps)[0];
  return { foreground, background, lead };
}

function growthMission(input: {
  investigationId: string;
  reference: PlayModel;
  workload: Workload;
  writeups: MissionWriteup[];
  skip: (factor: number) => boolean;
}): Scenario | null {
  const { reference, workload } = input;
  const { foreground, background, lead } = opsOf(workload);
  if (!lead) return null;
  for (const g of GROWTH) {
    if (input.skip(g.factor)) return null;
    const traffic = workload.peak * g.factor;
    const goals: Goal[] = [{ kind: "served", ops: foreground.map((o) => o.id), maxFailing: 0.01 }];
    if (background.length > 0) goals.push({ kind: "keeps-up", ops: background.map((o) => o.id) });
    const solve = solveFor(reference, workload, { traffic, goals });
    if (!solve || solve.edits.length === 0) continue;
    const count = provisioned(solve.model);
    const budget = Math.ceil(count * 1.25);
    goals.push({ kind: "budget", maxInstances: budget });
    const labelOf = (id: string) => reference.components.find((c) => c.id === id)?.label ?? id;
    const changes = solve.order.flatMap((id) => {
      const c = reference.components.find((x) => x.id === id);
      const before = reference.tuning[id];
      const after = solve.model.tuning[id];
      return c && before && after ? [describeChange(c, before, after)] : [];
    });
    const sim = simulate(reference, workload, traffic);
    const first = solve.order[0] as string;
    const firstUtil = sim.components[first]?.utilization ?? 0;
    const second = solve.order[1];
    const scenario: Scenario = {
      id: g.id,
      investigationId: input.investigationId,
      title: g.title,
      summary: `Grow to ${g.word} times today's peak on at most ${plural(budget, "machine")}.`,
      situation: `${workload.note} Now the product takes off: ${g.word} times today's peak, ${amountOf(lead.rps * traffic, lead.label)}. Keep failures under 1%${background.length > 0 ? " and the background work keeping up" : ""}, on no more than ${plural(budget, "machine")}.`,
      traffic,
      goals,
      hints: [
        { text: "Look for the part over 100%: it is the one turning requests away. Fix that one first, then look again." },
        {
          text: "More copies help a part that does the work itself. A database has two levers: shards split the writes, replicas share the reads.",
        },
        { text: `Start with ${labelOf(first)}.`, componentIds: [first] },
      ],
      debrief: {
        cost: `This answer runs ${plural(count, "machine")}, up from ${provisioned(reference)}: ${listOf(changes)}. The budget leaves a quarter more than that, so sizing every part to the same multiple will not fit.`,
        ...realWorldFor(
          input.writeups,
          "Real systems rarely grow every part evenly. The part that saturates first gets the attention, and teams measure where the time goes before they buy machines.",
        ),
        conceptIds: conceptsFor(solve, reference, []),
        interview: `At ${g.word} times the peak, ${labelOf(first)} saturates first, at ${loadOf(firstUtil)}, so I would scale it first${second ? ` and then ${labelOf(second)}, which is next to fall over` : ""}, sizing each to stay under 80% busy rather than multiplying everything.`,
        limits:
          "The model scales each part in proportion to its copies. Real systems run into limits it leaves out: connection counts, coordination between shards, hot keys, and the cost of moving data when you reshard.",
      },
      solution: solve.edits,
    };
    if (passes(reference, workload, scenario, [])) continue;
    if (!passes(reference, workload, scenario, solve.edits)) continue;
    return scenario;
  }
  return null;
}

function machineMission(input: {
  investigationId: string;
  reference: PlayModel;
  workload: Workload;
  writeups: MissionWriteup[];
  skip: (componentId: string) => boolean;
}): Scenario | null {
  const { reference, workload } = input;
  const { foreground } = opsOf(workload);
  const traffic = workload.peak;
  const sim = simulate(reference, workload, traffic);
  const onForeground = new Set(
    sim.operations.filter((o) => !o.background).flatMap((o) => o.route.slice(0, o.handoff ?? o.route.length)),
  );
  const targets = reference.components
    .filter((c) => !ROLES[c.role].managed && c.role !== "client" && c.role !== "cache")
    .filter((c) => sim.components[c.id]?.spof && onForeground.has(c.id) && !input.skip(c.id))
    .sort((a, b) => (sim.components[b.id]?.utilization ?? 0) - (sim.components[a.id]?.utilization ?? 0));
  for (const target of targets) {
    const fault: Fault = { kind: "kill", componentId: target.id, count: "one" };
    const affected = foreground.filter((o) =>
      sim.operations.find((r) => r.id === o.id)?.route.includes(target.id),
    );
    if (affected.length === 0) continue;
    const goals: Goal[] = [{ kind: "served", ops: affected.map((o) => o.id), maxFailing: 0.01, when: fault }];
    const solve = solveFor(reference, workload, { traffic, goals });
    if (!solve || solve.edits.length === 0) continue;
    const count = provisioned(solve.model);
    const budget = Math.ceil(count * 1.25);
    goals.push({ kind: "budget", maxInstances: budget });
    const database = target.role === "database";
    const changes = solve.order.flatMap((id) => {
      const c = reference.components.find((x) => x.id === id);
      const before = reference.tuning[id];
      const after = solve.model.tuning[id];
      return c && before && after ? [describeChange(c, before, after)] : [];
    });
    const opsText = listOf(affected.map((o) => lower(o.label)));
    const scenario: Scenario = {
      id: "lose-a-machine",
      investigationId: input.investigationId,
      title: database ? `${target.label} loses its primary` : `${target.label} loses a machine`,
      summary: `Keep ${opsText} going at peak when one ${database ? "primary" : "instance"} of ${target.label} dies.`,
      situation: `It is peak traffic, ${workload.peak} times the average, and one ${database ? "primary of" : "machine running"} ${target.label} dies. Every request for ${opsText} goes through it. Keep failures under 1% while it is gone, on no more than ${plural(budget, "machine")}.`,
      traffic,
      goals,
      hints: [
        { text: "Look at what is left running when the machine dies. Is there anything to take over its work?" },
        {
          text: database
            ? "A shard's data lives on its primary. Without a copy that can be promoted, losing the primary loses that data until it comes back."
            : "One copy is a single point of failure. The ones left also have to carry the dead one's share of the load.",
        },
        { text: `Give ${target.label} something to fail over to.`, componentIds: [target.id] },
      ],
      debrief: {
        cost: `This answer runs ${plural(count, "machine")}, up from ${provisioned(reference)}: ${listOf(changes)}. Redundancy is machines that sit mostly idle until the day they are needed.`,
        ...realWorldFor(
          input.writeups,
          "Production systems keep at least one spare for anything a request cannot do without, and test failover on purpose rather than finding out during an outage.",
        ),
        conceptIds: conceptsFor(solve, reference, ["replication"]),
        interview: database
          ? `${target.label} is a single point of failure: with one primary and nothing to promote, losing it stops ${opsText}. A replica per shard means a dead primary is replaced instead of taking its data with it.`
          : `${target.label} is a single point of failure: with one instance, losing it stops ${opsText}. Running ${plural(solve.model.tuning[target.id]?.instances ?? 2, "instance")}, sized so the rest can carry the load without the dead one, keeps them going.`,
        limits:
          "Failover here is instant. In practice, noticing the failure and promoting a replica or shifting traffic takes seconds to minutes, and requests in flight during that window fail or retry.",
      },
      solution: solve.edits,
    };
    if (passes(reference, workload, scenario, [])) continue;
    if (!passes(reference, workload, scenario, solve.edits)) continue;
    return scenario;
  }
  return null;
}

/** Every service, worker, queue and cache runs this many times what it needs when the mission starts. */
const OVERSIZED = 3;

function budgetMission(input: {
  investigationId: string;
  reference: PlayModel;
  workload: Workload;
  writeups: MissionWriteup[];
}): Scenario | null {
  const { reference, workload } = input;
  const { foreground, background } = opsOf(workload);
  const traffic = workload.peak;
  const goals: Goal[] = [{ kind: "served", ops: foreground.map((o) => o.id), maxFailing: 0.01 }];
  if (background.length > 0) goals.push({ kind: "keeps-up", ops: background.map((o) => o.id) });
  const solve = solveFor(reference, workload, { traffic, goals });
  if (!solve) return null;
  const trimmable = reference.components.filter(
    (c) => !ROLES[c.role].managed && c.role !== "client" && c.role !== "database" && reference.tuning[c.id],
  );
  if (trimmable.length === 0) return null;
  const start: Edit[] = trimmable.map((c) => ({
    tune: c.id,
    set: { instances: (solve.model.tuning[c.id]?.instances ?? 1) * OVERSIZED },
  }));
  const budget = provisioned(solve.model);
  const startModel = applyEdits(reference, start);
  const startCount = provisioned(startModel);
  if (startCount <= budget) return null;
  // Database changes the solver needed at peak stay in the answer; everything else goes back to its size.
  const solution: Edit[] = [
    ...trimmable.map((c) => ({ tune: c.id, set: { instances: solve.model.tuning[c.id]?.instances ?? 1 } })),
    ...solve.edits.filter((e) => "tune" in e && !trimmable.some((c) => c.id === e.tune)),
  ];
  const finalSim = simulate(applyEdits(startModel, solution), workload, traffic);
  const hottest = trimmable
    .map((c) => ({ c, util: finalSim.components[c.id]?.utilization ?? 0 }))
    .sort((x, y) => y.util - x.util)[0];
  const biggest = [...trimmable].sort(
    (x, y) => (startModel.tuning[y.id]?.instances ?? 0) - (startModel.tuning[x.id]?.instances ?? 0),
  )[0] as PlayComponent;
  const needed = solve.model.tuning[biggest.id]?.instances ?? 1;
  goals.push({ kind: "budget", maxInstances: budget });
  const scenario: Scenario = {
    id: "right-size",
    investigationId: input.investigationId,
    title: "Paying for idle machines",
    summary: `Cut ${startCount} machines to ${budget} without failing at peak.`,
    situation: `Someone sized this for a launch that never came: every service, worker, queue and cache runs about ${OVERSIZED} times the machines it needs, ${plural(startCount, "machine")} in all. Peak is ${workload.peak} times the average. Get it down to ${plural(budget, "machine")} without failing more than 1% of requests${background.length > 0 ? " or letting the background work fall behind" : ""}.`,
    traffic,
    start,
    goals,
    hints: [
      { text: "Check how busy each part is at peak. A part at a third of its capacity is paying for idle machines." },
      { text: "Leave some headroom: a part sized to exactly 100% fails on the first spike above peak." },
      { text: `Start with ${biggest.label}, which has the most machines to give back.`, componentIds: [biggest.id] },
    ],
    debrief: {
      cost: `Every machine cut is money saved every hour, but the parts now run closer to their limit${hottest && hottest.util > 0 ? `: ${hottest.c.label} sits at ${percent(hottest.util)} busy at peak, so a spike above peak reaches it sooner` : ""}.`,
      ...realWorldFor(
        input.writeups,
        "Teams size from measured load, keep headroom for deploys and for losing a zone, and let autoscaling or a capacity review add machines as the peak grows.",
      ),
      conceptIds: ["backpressure", "load-shedding"],
      interview: `I size from the numbers: at peak ${biggest.label} needs about ${plural(needed, "instance")} to stay under 80% busy, so I would run that, not ${OVERSIZED} times as many, and add capacity when the measured peak grows.`,
      limits:
        "The model only checks the peak you set. Real capacity plans also keep room for deploys, a lost availability zone, daily cycles and the time new machines take to start.",
    },
    solution,
  };
  if (passes(reference, workload, scenario, [])) return null;
  if (!passes(reference, workload, scenario, solution)) return null;
  return scenario;
}

/**
 * The missions a system's playground offers on top of its hand-written scenarios: growing to several times
 * its peak, and losing a machine nothing can take over from. `existing` are the hand-written ones, so a
 * mission they already cover is left out.
 */
export function standardMissions(input: {
  investigationId: string;
  reference: PlayModel;
  workload: Workload;
  writeups?: MissionWriteup[];
  existing?: Scenario[];
}): Scenario[] {
  const existing = input.existing ?? [];
  const writeups = input.writeups ?? [];
  const taken = new Set(existing.map((s) => s.id));
  const missions: Scenario[] = [];
  const growth = growthMission({
    ...input,
    writeups,
    skip: (factor) =>
      existing.some(
        (s) => s.traffic * Math.max(1, ...Object.values(s.surge ?? {})) >= input.workload.peak * factor && !s.faults?.length,
      ),
  });
  if (growth) missions.push(growth);
  const killed = new Set(
    existing.flatMap((s) => [
      ...(s.faults ?? []).filter((f) => f.kind === "kill").map((f) => f.componentId),
      ...s.goals.flatMap((g) => (g.kind === "served" && g.when?.kind === "kill" ? [g.when.componentId] : [])),
    ]),
  );
  const machine = machineMission({ ...input, writeups, skip: (id) => killed.has(id) });
  if (machine) missions.push(machine);
  const budget = budgetMission({ ...input, writeups });
  if (budget) missions.push(budget);
  return missions.filter((m) => !taken.has(m.id));
}
