/**
 * Two designs side by side, under the same traffic and the same failure. Interviews probe trade-offs: one design
 * is faster and costs more, another survives a failure the first does not. This puts numbers on both sides.
 *
 * Pure and client-safe.
 */
import { ROLES, simulate, type PlayModel, type Simulation, type Workload } from "./playground";
import { injectFault, provisioned, type Fault } from "./scenarios";

export type Measured = {
  /** Share of requests someone waits on that fail. */
  failing: number;
  /** Share of background work that piles up instead of being done. */
  behind: number;
  ops: { id: string; label: string; reachable: boolean; latencyMs: number; p99Ms: number; saturated: boolean }[];
  /** Instances paid for. */
  instances: number;
  /** Parts that stop something when their one instance (or primary) dies. */
  spofs: string[];
};

/**
 * What a simulation says about a design. Single points of failure are a property of the design, not of the
 * moment: pass the simulation without the failure as `intact` so a part that is already dead still counts.
 */
export function measureSim(model: PlayModel, sim: Simulation, regions = 1, intact: Simulation = sim): Measured {
  const fg = sim.operations.filter((o) => !o.background);
  const bg = sim.operations.filter((o) => o.background);
  const offered = fg.reduce((s, o) => s + o.offered, 0);
  const bgOffered = bg.reduce((s, o) => s + o.offered, 0);
  const label = (id: string) => model.components.find((c) => c.id === id)?.label ?? id;
  return {
    failing: offered > 0 ? fg.reduce((s, o) => s + o.failed, 0) / offered : 0,
    behind: bgOffered > 0 ? bg.reduce((s, o) => s + o.backlog, 0) / bgOffered : 0,
    ops: fg.map((o) => ({
      id: o.id,
      label: o.label,
      reachable: o.reachable,
      latencyMs: o.latencyMs,
      p99Ms: o.p99Ms,
      saturated: o.saturated,
    })),
    instances: provisioned(model) * Math.max(1, regions),
    spofs: Object.entries(intact.components)
      .filter(([, r]) => r.spof)
      .map(([id]) => label(id)),
  };
}

/** Runs a design at a traffic level, with a failure on top if there is one. */
export function measure(
  model: PlayModel,
  workload: Workload,
  traffic: number,
  fault?: Fault | null,
  regions = 1,
): Measured {
  const intact = simulate(model, workload, traffic);
  const sim = fault ? simulate(injectFault(model, fault), workload, traffic) : intact;
  return measureSim(model, sim, regions, intact);
}

export type FaultOption = { id: string; label: string; fault: Fault | null };

/** Failures worth comparing under: losing an instance, a whole part, a slowdown, or an empty cache. */
export function faultOptions(models: PlayModel[]): FaultOption[] {
  const seen = new Set<string>();
  const options: FaultOption[] = [{ id: "none", label: "Nothing broken", fault: null }];
  for (const model of models) {
    for (const c of model.components) {
      if (c.role === "client" || seen.has(c.id)) continue;
      seen.add(c.id);
      const managed = ROLES[c.role].managed;
      if (!managed) {
        options.push({
          id: `kill-one:${c.id}`,
          label: c.role === "database" ? `${c.label} loses a primary` : `${c.label} loses an instance`,
          fault: { kind: "kill", componentId: c.id, count: "one" },
        });
        options.push({
          id: `kill-all:${c.id}`,
          label: `${c.label} goes down entirely`,
          fault: { kind: "kill", componentId: c.id, count: "all" },
        });
      }
      options.push({ id: `slow:${c.id}`, label: `${c.label} gets 5× slower`, fault: { kind: "slow", componentId: c.id, factor: 5 } });
      if (c.role === "cache" || c.role === "cdn") {
        options.push({ id: `cold:${c.id}`, label: `${c.label} restarts empty`, fault: { kind: "cold", componentId: c.id } });
      }
    }
  }
  return options;
}

export type Side = "a" | "b" | null;
export type CompareRow = { id: string; label: string; a: string; b: string; better: Side };

const pct = (n: number) => {
  if (n <= 0) return "0%";
  if (n < 0.001) return "<0.1%";
  return `${(n * 100).toFixed(n < 0.1 ? 1 : 0).replace(/\.0$/, "")}%`;
};
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`);

/** Lower is better; differences inside the tolerance are a draw. */
function lower(a: number, b: number, tolerance: number): Side {
  if (Math.abs(a - b) <= tolerance) return null;
  return a < b ? "a" : "b";
}

/** Rows to put side by side, each saying which design does better on it, if either. */
export function compareRows(a: Measured, b: Measured): CompareRow[] {
  const rows: CompareRow[] = [
    { id: "failing", label: "Requests failing", a: pct(a.failing), b: pct(b.failing), better: lower(a.failing, b.failing, 0.0005) },
  ];
  if (a.behind > 0 || b.behind > 0) {
    rows.push({
      id: "behind",
      label: "Background work falling behind",
      a: a.behind <= 0.01 ? "keeping up" : pct(a.behind),
      b: b.behind <= 0.01 ? "keeping up" : pct(b.behind),
      better: lower(Math.max(0, a.behind - 0.01), Math.max(0, b.behind - 0.01), 0.005),
    });
  }
  const ids = [...new Set([...a.ops.map((o) => o.id), ...b.ops.map((o) => o.id)])];
  for (const id of ids) {
    const x = a.ops.find((o) => o.id === id);
    const y = b.ops.find((o) => o.id === id);
    const label = x?.label ?? y?.label ?? id;
    const show = (o: typeof x, which: "latencyMs" | "p99Ms") =>
      !o ? "–" : !o.reachable ? "cut off" : which === "p99Ms" && o.saturated ? "no limit" : ms(o[which]);
    // An operation that is cut off or saturated loses to one that is not, whatever the numbers say.
    const score = (o: typeof x, which: "latencyMs" | "p99Ms") =>
      !o || !o.reachable ? Infinity : which === "p99Ms" && o.saturated ? 1e12 : o[which];
    const better = (which: "latencyMs" | "p99Ms") => {
      const sa = score(x, which);
      const sb = score(y, which);
      if (sa === sb) return null;
      if (!Number.isFinite(sa) || !Number.isFinite(sb) || sa >= 1e12 || sb >= 1e12) return sa < sb ? "a" : "b";
      return lower(sa, sb, Math.max(1, 0.05 * Math.min(sa, sb)));
    };
    rows.push({ id: `${id}-mean`, label: `${label}: average wait`, a: show(x, "latencyMs"), b: show(y, "latencyMs"), better: better("latencyMs") });
    rows.push({ id: `${id}-p99`, label: `${label}: p99`, a: show(x, "p99Ms"), b: show(y, "p99Ms"), better: better("p99Ms") });
  }
  rows.push({
    id: "instances",
    label: "Instances you pay for",
    a: a.instances.toLocaleString("en-US"),
    b: b.instances.toLocaleString("en-US"),
    better: lower(a.instances, b.instances, 0),
  });
  rows.push({
    id: "spofs",
    label: "Single points of failure",
    a: a.spofs.length === 0 ? "none" : String(a.spofs.length),
    b: b.spofs.length === 0 ? "none" : String(b.spofs.length),
    better: lower(a.spofs.length, b.spofs.length, 0),
  });
  return rows;
}

/** The trade-off in a sentence: what each design wins on. */
export function tradeOff(rows: CompareRow[]): string {
  const wins = (side: "a" | "b") => rows.filter((r) => r.better === side).map((r) => r.label.toLowerCase());
  const a = wins("a");
  const b = wins("b");
  const list = (items: string[]) =>
    items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
  if (a.length === 0 && b.length === 0) return "Under these conditions the two designs come out the same.";
  if (a.length === 0) return `B does better on ${list(b)}, and A does better on nothing here.`;
  if (b.length === 0) return `A does better on ${list(a)}, and B does better on nothing here.`;
  return `A does better on ${list(a)}; B does better on ${list(b)}. That is the trade-off to defend.`;
}
