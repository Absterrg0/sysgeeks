/**
 * "Defend it": the follow-up questions an interviewer asks once a design looks done. What runs out first if
 * traffic keeps growing? What happens when this part loses an instance, or that one gets slow? The person
 * predicts, and the playground's own model gives the answer, with the numbers that decide it. No AI and no
 * rubric: every answer is computed from the design on screen.
 *
 * Pure and client-safe.
 */
import { ROLES, simulate, type PlayModel, type Simulation, type Workload } from "./playground";
import { injectFault, type Fault } from "./scenarios";

export type DefendOption = { id: string; label: string };

export type DefendQuestion = {
  id: string;
  prompt: string;
  options: DefendOption[];
  answer: string;
  /** Why the answer is what it is, with the model's numbers. */
  explain: string;
  /** Parts to point at once answered. */
  componentIds: string[];
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`);

type Outcome = "cut-off" | "some-fail" | "behind" | "slower" | "nothing";

const OUTCOMES: Record<Outcome, string> = {
  "cut-off": "Something stops working entirely",
  "some-fail": "Some requests fail",
  behind: "Callers are fine, but background work falls behind",
  slower: "Callers wait longer, but nothing fails",
  nothing: "Nothing a caller would notice",
};

function failingShare(sim: Simulation): number {
  const fg = sim.operations.filter((o) => !o.background);
  const offered = fg.reduce((s, o) => s + o.offered, 0);
  return offered > 0 ? fg.reduce((s, o) => s + o.failed, 0) / offered : 0;
}

function behindShare(sim: Simulation): number {
  const bg = sim.operations.filter((o) => o.background);
  const offered = bg.reduce((s, o) => s + o.offered, 0);
  return offered > 0 ? bg.reduce((s, o) => s + o.backlog, 0) / offered : 0;
}

/** What a failure does, compared with the same design without it, and a sentence with the numbers. */
function outcomeOf(before: Simulation, after: Simulation): { outcome: Outcome; because: string } {
  const cut = after.operations.filter(
    (o) => !o.background && !o.reachable && before.operations.find((b) => b.id === o.id)?.reachable,
  );
  if (cut.length > 0) {
    return { outcome: "cut-off", because: `${cut.map((o) => o.label).join(" and ")} ${cut.length === 1 ? "has" : "have"} nowhere to go.` };
  }
  const failing = failingShare(after) - failingShare(before);
  if (failing > 0.001) return { outcome: "some-fail", because: `${pct(failing)} more of the requests people wait on fail.` };
  const behind = behindShare(after) - behindShare(before);
  if (behind > 0.01) return { outcome: "behind", because: `Background work falls ${pct(behind)} behind what arrives, and the backlog grows.` };
  let worst: { label: string; from: number; to: number; tail: boolean } | undefined;
  for (const o of after.operations) {
    if (o.background || !o.reachable) continue;
    const b = before.operations.find((x) => x.id === o.id);
    if (!b || !b.reachable) continue;
    const meanUp = o.latencyMs > b.latencyMs * 1.1 + 0.5;
    const tailUp = o.saturated || o.p99Ms > b.p99Ms * 1.2 + 1;
    if (!meanUp && !tailUp) continue;
    const growth = o.saturated ? Infinity : o.p99Ms / Math.max(1, b.p99Ms);
    if (!worst || growth > worst.to / Math.max(1, worst.from)) {
      worst = { label: o.label, from: b.p99Ms, to: o.saturated ? Infinity : o.p99Ms, tail: true };
    }
  }
  if (worst) {
    return {
      outcome: "slower",
      because: Number.isFinite(worst.to)
        ? `${worst.label}: p99 goes from ${ms(worst.from)} to ${ms(worst.to)}, and nothing fails.`
        : `${worst.label}: a part it waits on is now over capacity, so its wait keeps growing.`,
    };
  }
  return { outcome: "nothing", because: "The remaining capacity carries the load without a visible change." };
}

function outcomeQuestion(input: {
  id: string;
  prompt: string;
  model: PlayModel;
  workload: Workload;
  traffic: number;
  base: Simulation;
  fault: Fault;
  lead: string;
}): DefendQuestion {
  const after = simulate(injectFault(input.model, input.fault), input.workload, input.traffic);
  const { outcome, because } = outcomeOf(input.base, after);
  const hasBackground = input.base.operations.some((o) => o.background);
  const ids: Outcome[] = hasBackground
    ? ["nothing", "slower", "behind", "some-fail", "cut-off"]
    : ["nothing", "slower", "some-fail", "cut-off"];
  return {
    id: input.id,
    prompt: input.prompt,
    options: ids.map((id) => ({ id, label: OUTCOMES[id] })),
    answer: outcome,
    explain: `${input.lead} ${because}`.trim(),
    componentIds: [input.fault.componentId],
  };
}

/**
 * Up to three follow-ups for a design at a traffic level: what runs out first, what losing an instance of the
 * busiest replaceable part does, and what an empty cache (or, without one, a slow dependency) does.
 */
export function defendQuestions(model: PlayModel, workload: Workload, traffic: number): DefendQuestion[] {
  const base = simulate(model, workload, traffic);
  const byId = new Map(model.components.map((c) => [c.id, c]));
  const questions: DefendQuestion[] = [];
  const onWaitedRoute = (id: string) =>
    base.operations.some((o) => !o.background && o.reachable && o.route.slice(1, (o.handoff ?? o.route.length - 1) + 1).includes(id));
  const parts = model.components.filter(
    (c) => c.role !== "client" && !ROLES[c.role].managed && (base.components[c.id]?.reads ?? 0) + (base.components[c.id]?.writes ?? 0) > 0,
  );

  // 1. What runs out first.
  const byLoad = [...parts].sort(
    (a, b) => (base.components[b.id]?.utilization ?? 0) - (base.components[a.id]?.utilization ?? 0),
  );
  const [first, second] = byLoad;
  const u1 = first ? (base.components[first.id]?.utilization ?? 0) : 0;
  const u2 = second ? (base.components[second.id]?.utilization ?? 0) : 0;
  if (first && second && u1 > 0 && u2 / u1 < 0.95) {
    const choices = byLoad.slice(0, 4).sort((a, b) => a.label.localeCompare(b.label));
    questions.push({
      id: "runs-out-first",
      prompt: "Traffic keeps growing from here. Which part runs out of room first?",
      options: choices.map((c) => ({ id: c.id, label: c.label })),
      answer: first.id,
      explain:
        u1 >= 1
          ? `${first.label} is already past what it can handle (${pct(u1)}). ${second.label} is next at ${pct(u2)}.`
          : `${first.label} is at ${pct(u1)} of what it can do, so it runs out at about ${(1 / u1).toFixed(1)}× this traffic. ${second.label} is next at ${pct(u2)}.`,
      componentIds: [first.id],
    });
  }

  // 2. Losing one instance of the busiest part people wait on: one with a spare if there is one, since a lone
  // instance dying is the easy case.
  const waited = byLoad.filter((c) => onWaitedRoute(c.id));
  const spare = (id: string) => {
    const t = model.tuning[id];
    const c = byId.get(id);
    if (!t || !c) return false;
    return c.role === "database" ? t.replicas > 0 : t.instances - t.down > 1;
  };
  const target = waited.find((c) => spare(c.id)) ?? waited[0];
  if (target) {
    const t = model.tuning[target.id];
    const database = target.role === "database";
    const count = database ? (t?.instances ?? 1) : (t?.instances ?? 1) - (t?.down ?? 0);
    questions.push(
      outcomeQuestion({
        id: "lose-one",
        prompt: database
          ? `${target.label} loses a primary at this traffic. What happens?`
          : `${target.label} loses one of its ${count} instance${count === 1 ? "" : "s"} at this traffic. What happens?`,
        model,
        workload,
        traffic,
        base,
        fault: { kind: "kill", componentId: target.id, count: "one" },
        lead: database
          ? (t?.replicas ?? 0) > 0
            ? "A replica is promoted in its place."
            : (t?.instances ?? 1) > 1
              ? "Its shard's data has no other copy."
              : "It has no replica to take over."
          : count > 1
            ? `The other ${count - 1} take its share.`
            : "There is no other instance.",
      }),
    );
  }

  // 3. An empty cache, or a slow dependency.
  const cache = model.components.find((c) => (c.role === "cache" || c.role === "cdn") && (base.components[c.id]?.absorbed ?? 0) > 0);
  if (cache) {
    questions.push(
      outcomeQuestion({
        id: "cold-cache",
        prompt: `${cache.label} restarts empty and answers nothing until it refills. What happens meanwhile?`,
        model,
        workload,
        traffic,
        base,
        fault: { kind: "cold", componentId: cache.id },
        lead: `Everything it answered (${Math.round(base.components[cache.id]?.absorbed ?? 0).toLocaleString("en-US")}/s) goes on to what is behind it.`,
      }),
    );
  } else {
    // The part that adds the most time to the busiest operation people wait on.
    const latency = (c: { id: string; role: keyof typeof ROLES }) => workload.latency?.[c.id] ?? ROLES[c.role].latency;
    const op = base.operations
      .filter((o) => !o.background && o.reachable)
      .sort((a, b) => b.offered - a.offered)[0];
    const slowest = op?.route
      .slice(1, (op.handoff ?? op.route.length - 1) + 1)
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c) && c?.role !== "client")
      .sort((a, b) => latency(b) - latency(a))[0];
    if (slowest) {
      questions.push(
        outcomeQuestion({
          id: "slow-part",
          prompt: `${slowest.label} starts answering 5× slower. What happens?`,
          model,
          workload,
          traffic,
          base,
          fault: { kind: "slow", componentId: slowest.id, factor: 5 },
          lead: ROLES[slowest.role].managed
            ? "A provider that slows down costs you time, not capacity."
            : "Each request now holds it 5× as long, so it also has a fifth of the room.",
        }),
      );
    }
  }
  return questions;
}
