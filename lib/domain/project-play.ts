/**
 * Playing your own system: the traffic you say it carries, run through the parts and flows you drew, under the
 * same deterministic model as the curated systems. Nothing here leaves the browser.
 *
 * The person states reads and writes per second, payload sizes, a peak multiplier and how many regions it runs
 * in. Operations are found from the drawing: reads and writes go from a client to the store they end at, and
 * background work follows asynchronous flows and the workers that read from queues and stores on the write path.
 *
 * Pure and client-safe.
 */
import type { ArchitectureComponent, ArchitectureFlow } from "./content";
import { autoLayout } from "./layout";
import {
  ROLES,
  playModelOf,
  roleOf,
  simulate,
  type Operation,
  type PlayModel,
  type Simulation,
  type Workload,
} from "./playground";
import { injectFault, provisioned } from "./scenarios";

export type ProjectTraffic = {
  /** Average reads per second, across every region. */
  readsPerSecond: number;
  /** Average writes per second, across every region. */
  writesPerSecond: number;
  readKB: number;
  writeKB: number;
  /** Peak as a multiple of the average. */
  peak: number;
  /** Full copies of the design, each taking an equal share of traffic. */
  regions: number;
  /** What 99 in 100 callers should finish within, at peak. */
  p99TargetMs: number;
  /** Where reads and writes start and end; found from the drawing when not chosen. */
  readEntry?: string;
  readTarget?: string;
  writeEntry?: string;
  writeTarget?: string;
};

export const DEFAULT_TRAFFIC: ProjectTraffic = {
  readsPerSecond: 200,
  writesPerSecond: 20,
  readKB: 4,
  writeKB: 2,
  peak: 3,
  regions: 1,
  p99TargetMs: 300,
};

/** A round trip between two regions, such as US east to US west. Assumed, not measured. */
export const CROSS_REGION_MS = 70;

export const LIMITS = {
  rate: { min: 0, max: 10_000_000 },
  kb: { min: 0, max: 100_000 },
  peak: { min: 1, max: 100 },
  regions: { min: 1, max: 6 },
  p99: { min: 1, max: 60_000 },
} as const;

const clamp = (n: unknown, lo: number, hi: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;

/** Stored traffic, made safe: numbers in range, unknown fields dropped. */
export function parseTraffic(raw: unknown): ProjectTraffic {
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id = (x: unknown) => (typeof x === "string" && /^[a-z0-9-]+$/.test(x) ? x : undefined);
  const out: ProjectTraffic = {
    readsPerSecond: clamp(v.readsPerSecond, LIMITS.rate.min, LIMITS.rate.max, DEFAULT_TRAFFIC.readsPerSecond),
    writesPerSecond: clamp(v.writesPerSecond, LIMITS.rate.min, LIMITS.rate.max, DEFAULT_TRAFFIC.writesPerSecond),
    readKB: clamp(v.readKB, LIMITS.kb.min, LIMITS.kb.max, DEFAULT_TRAFFIC.readKB),
    writeKB: clamp(v.writeKB, LIMITS.kb.min, LIMITS.kb.max, DEFAULT_TRAFFIC.writeKB),
    peak: clamp(v.peak, LIMITS.peak.min, LIMITS.peak.max, DEFAULT_TRAFFIC.peak),
    regions: Math.round(clamp(v.regions, LIMITS.regions.min, LIMITS.regions.max, DEFAULT_TRAFFIC.regions)),
    p99TargetMs: clamp(v.p99TargetMs, LIMITS.p99.min, LIMITS.p99.max, DEFAULT_TRAFFIC.p99TargetMs),
  };
  for (const key of ["readEntry", "readTarget", "writeEntry", "writeTarget"] as const) {
    const value = id(v[key]);
    if (value) out[key] = value;
  }
  return out;
}

/** Back-of-envelope: people a day times what each does a day, spread over 86,400 seconds. */
export function perSecondFromDaily(people: number, perPersonPerDay: number): number {
  if (!(people > 0) || !(perPersonPerDay > 0)) return 0;
  return (people * perPersonPerDay) / 86_400;
}

// ---------------------------------------------------------------------------
// Finding the operations in a drawing
// ---------------------------------------------------------------------------

type Drawing = { components: ArchitectureComponent[]; flows: ArchitectureFlow[] };

const STORE_KINDS = new Set(["database", "object-store", "cache"]);
const READ_PREFERENCE = ["database", "object-store", "cache", "external", "service"] as const;
const WRITE_PREFERENCE = ["database", "object-store", "stream", "queue", "cache", "service", "external"] as const;

/** Shortest path along flow directions (request and data flows), from one part to another. */
function directedPath(drawing: Drawing, from: string, to: string, through?: (id: string) => boolean): string[] | null {
  const next = new Map<string, string[]>();
  for (const f of drawing.flows) {
    if (f.kind !== "request" && f.kind !== "data") continue;
    next.set(f.from, [...(next.get(f.from) ?? []), f.to]);
  }
  const previous = new Map<string, string>([[from, from]]);
  const queue = [from];
  while (queue.length > 0) {
    const at = queue.shift() as string;
    if (at === to) break;
    for (const n of next.get(at) ?? []) {
      if (previous.has(n)) continue;
      if (through && n !== to && !through(n)) continue;
      previous.set(n, at);
      queue.push(n);
    }
  }
  if (!previous.has(to)) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(previous.get(path[0] as string) as string);
  return path;
}

/** Places a person's requests start: clients, or parts nothing calls when there is no client. */
export function entriesOf(drawing: Drawing): ArchitectureComponent[] {
  const clients = drawing.components.filter((c) => c.kind === "client");
  if (clients.length > 0) return clients;
  const called = new Set(drawing.flows.map((f) => f.to));
  return drawing.components.filter((c) => !called.has(c.id));
}

/** Parts a request from `entry` can end at, best first for reads or for writes. */
export function targetsOf(drawing: Drawing, entry: string, kind: "read" | "write"): ArchitectureComponent[] {
  const order: readonly string[] = kind === "read" ? READ_PREFERENCE : WRITE_PREFERENCE;
  return drawing.components
    .filter((c) => c.id !== entry && order.includes(c.kind) && directedPath(drawing, entry, c.id))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

/**
 * The route a read or write takes. A read enters through the edge (a CDN or load balancer) when the drawing has
 * one in front of its first hop, and a write through a load balancer, since that is how those parts are used.
 */
function routeFor(drawing: Drawing, entry: string, target: string, kind: "read" | "write"): string[] | null {
  const byId = new Map(drawing.components.map((c) => [c.id, c]));
  const shortest = directedPath(drawing, entry, target);
  if (!shortest) return null;
  const edges = drawing.flows
    .filter((f) => f.from === entry && byId.get(f.to)?.kind === "edge")
    .map((f) => byId.get(f.to) as ArchitectureComponent)
    .filter((c) => kind === "read" || roleOf(c) === "lb");
  for (const edge of edges) {
    const rest = directedPath(drawing, edge.id, target, (id) => id !== entry);
    if (rest) return [entry, ...rest];
  }
  return shortest;
}

/** Background work started by writes: asynchronous flows, and workers that read from stores on the write path. */
function backgroundRoutes(drawing: Drawing, writePath: string[]): string[][] {
  const byId = new Map(drawing.components.map((c) => [c.id, c]));
  const onPath = new Set(writePath);
  const kindOf = (id: string) => byId.get(id)?.kind;
  const routes: string[][] = [];
  const starts: [string, string][] = [];
  for (const f of drawing.flows) {
    // Something on the write path hands work on.
    if (onPath.has(f.from) && !onPath.has(f.to) && f.kind === "async" && kindOf(f.to) !== "client") {
      starts.push([f.from, f.to]);
    }
    // A worker reads what the write path left in a store or queue (an outbox relay, a consumer).
    const reader = kindOf(f.from);
    if (
      onPath.has(f.to) &&
      !onPath.has(f.from) &&
      (reader === "worker" || reader === "service") &&
      ["database", "queue", "stream", "object-store"].includes(kindOf(f.to) ?? "")
    ) {
      starts.push([f.to, f.from]);
    }
  }
  const rank = (id: string) => {
    const order = ["queue", "stream", "worker", "service", "database", "object-store", "external", "cache", "edge"];
    const i = order.indexOf(kindOf(id) ?? "");
    return i < 0 ? order.length : i;
  };
  for (const [from, to] of starts) {
    const route = [from, to];
    const seen = new Set(route);
    while (route.length < 7) {
      const at = route.at(-1) as string;
      const kind = kindOf(at);
      if (kind && route.length > 2 && (STORE_KINDS.has(kind) || kind === "external")) break;
      let candidates: string[];
      if (kind === "queue" || kind === "stream") {
        candidates = drawing.flows
          .flatMap((f) => (f.to === at && f.kind === "request" ? [f.from] : f.from === at ? [f.to] : []))
          .filter((id) => !seen.has(id) && !onPath.has(id) && ["worker", "service"].includes(kindOf(id) ?? ""));
      } else {
        candidates = drawing.flows
          .filter(
            (f) =>
              f.from === at && f.kind !== "push" && !seen.has(f.to) && !onPath.has(f.to) && kindOf(f.to) !== "client",
          )
          .map((f) => f.to);
      }
      const nextId = [...candidates].sort((a, b) => rank(a) - rank(b))[0];
      if (!nextId) break;
      route.push(nextId);
      seen.add(nextId);
    }
    // A chain already covered by a longer one adds nothing.
    const key = route.join(">");
    if (route.length >= 2 && !routes.some((r) => r.join(">").includes(key) || key.includes(r.join(">")))) {
      routes.push(route);
    }
  }
  return routes.slice(0, 4);
}

/** "Order queue → Ticket store", eliding the middle of a long chain. */
function describeRoute(labels: string[]): string {
  if (labels.length <= 2) return labels.join(" → ");
  return labels.length === 3 ? labels.join(" → ") : `${labels[0]} → … → ${labels.at(-1)}`;
}

export type ProjectOperations = {
  operations: Operation[];
  read?: { entry: string; target: string };
  write?: { entry: string; target: string };
};

/** The operations a drawing carries at the stated traffic, before any multiplier or region split. */
export function projectOperations(drawing: Drawing, traffic: ProjectTraffic): ProjectOperations {
  const ids = new Set(drawing.components.map((c) => c.id));
  const label = (id: string) => drawing.components.find((c) => c.id === id)?.label ?? id;
  const entries = entriesOf(drawing);
  // Reads start from the first entry that reaches a store. Writes start from whichever entry reaches the most
  // durable place: a database before a queue, a queue before a third party.
  const pick = (kind: "read" | "write", chosenEntry?: string, chosenTarget?: string) => {
    const order: readonly string[] = kind === "read" ? READ_PREFERENCE : WRITE_PREFERENCE;
    const tryEntries = chosenEntry && ids.has(chosenEntry) ? [chosenEntry] : entries.map((e) => e.id);
    let best: { entry: string; target: string; path: string[]; rank: number } | undefined;
    for (const entry of tryEntries) {
      const targets = targetsOf(drawing, entry, kind);
      const chosen = chosenTarget ? targets.find((t) => t.id === chosenTarget) : undefined;
      const target = chosen ?? targets[0];
      if (!target) continue;
      const path = routeFor(drawing, entry, target.id, kind);
      if (!path) continue;
      const rank = chosen ? -1 : order.indexOf(target.kind);
      if (!best || rank < best.rank) best = { entry, target: target.id, path, rank };
      if (kind === "read" || rank <= 0) break;
    }
    return best && { entry: best.entry, target: best.target, path: best.path };
  };
  const read = pick("read", traffic.readEntry, traffic.readTarget);
  const write = pick("write", traffic.writeEntry, traffic.writeTarget);
  const operations: Operation[] = [];
  if (read && traffic.readsPerSecond > 0) {
    operations.push({
      id: "reads",
      label: "Reads",
      rps: traffic.readsPerSecond,
      kind: "read",
      cacheable: true,
      path: read.path,
      payloadKB: traffic.readKB,
    });
  }
  const writeTarget = write ? drawing.components.find((c) => c.id === write.target) : undefined;
  if (write && traffic.writesPerSecond > 0) {
    operations.push({
      id: "writes",
      label: "Writes",
      rps: traffic.writesPerSecond,
      kind: "write",
      path: write.path,
      payloadKB: traffic.writeKB,
      // One primary takes every write, so writes from the other regions travel to it and back.
      remote:
        traffic.regions > 1 && writeTarget?.kind === "database"
          ? { share: (traffic.regions - 1) / traffic.regions, ms: CROSS_REGION_MS }
          : undefined,
    });
    backgroundRoutes(drawing, write.path).forEach((route, i) => {
      operations.push({
        id: `background-${i + 1}`,
        label: describeRoute(route.slice(1).map(label)),
        rps: traffic.writesPerSecond,
        kind: "write",
        background: true,
        path: route,
        assumed: true,
      });
    });
  }
  return {
    operations,
    read: read && { entry: read.entry, target: read.target },
    write: write && { entry: write.entry, target: write.target },
  };
}

// ---------------------------------------------------------------------------
// Playing it
// ---------------------------------------------------------------------------

export type ProjectPlay = {
  /** The drawing as a playable design: one instance of everything, laid out automatically. */
  reference: PlayModel;
  workload: Workload;
  found: ProjectOperations;
};

export function projectPlay(drawing: Drawing, traffic: ProjectTraffic): ProjectPlay {
  const found = projectOperations(drawing, traffic);
  const workload: Workload = {
    peak: traffic.peak,
    operations: found.operations,
    note: "Your numbers.",
  };
  const placed = autoLayout(drawing.components, drawing.flows);
  const reference = playModelOf({ components: placed, flows: drawing.flows }, workload);
  return { reference, workload, found };
}

/** Traffic each region carries, as a multiple of the average: every region takes an equal share. */
export function perRegion(multiplier: number, regions: number): number {
  return multiplier / Math.max(1, regions);
}

/** Instances paid for across every region. */
export function paidFor(model: PlayModel, regions: number): number {
  return provisioned(model) * Math.max(1, regions);
}

export type CheckStatus = "met" | "missed" | "info";

export type ProjectCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  actual: string;
  target: string;
  /** Parts to point at. */
  componentIds: string[];
  /** One line on what decided it. */
  detail?: string;
};

const share = (n: number) => {
  if (n <= 0) return "0%";
  if (n < 0.001) return "<0.1%";
  return `${(n * 100).toFixed(n < 0.1 ? 1 : 0).replace(/\.0$/, "")}%`;
};
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`);

function failing(sim: Simulation): number {
  const fg = sim.operations.filter((o) => !o.background);
  const offered = fg.reduce((s, o) => s + o.offered, 0);
  return offered > 0 ? fg.reduce((s, o) => s + o.failed, 0) / offered : 0;
}

function trouble(sim: Simulation): string[] {
  return Object.entries(sim.components)
    .filter(([, r]) => r.status === "down" || r.status === "over" || r.lost > 0)
    .map(([id]) => id);
}

/** At most this share failing counts as holding. */
const ALLOWED_FAILING = 0.001;

/**
 * What your own design has to hold at its stated peak: requests served, the p99 you set, background work kept up,
 * any single part losing an instance, and, across regions, losing a whole region.
 */
export function projectChecks(model: PlayModel, workload: Workload, traffic: ProjectTraffic): ProjectCheck[] {
  const at = perRegion(traffic.peak, traffic.regions);
  const sim = simulate(model, workload, at);
  const byId = new Map(model.components.map((c) => [c.id, c]));
  const name = (id: string) => byId.get(id)?.label ?? id;
  const checks: ProjectCheck[] = [];
  const fg = sim.operations.filter((o) => !o.background);
  if (fg.length === 0) return checks;

  const peakFailing = failing(sim);
  checks.push({
    id: "peak",
    label: `At peak (×${traffic.peak}): requests failing`,
    status: peakFailing <= ALLOWED_FAILING + 1e-12 ? "met" : "missed",
    actual: share(peakFailing),
    target: "≤ 0.1%",
    componentIds: [...new Set([...fg.flatMap((o) => (o.blockedBy ? [o.blockedBy] : [])), ...trouble(sim)])],
  });

  for (const o of fg) {
    const slowest = o.route
      .filter((id) => !ROLES[byId.get(id)?.role ?? "client"].managed)
      .sort((a, b) => (sim.components[b]?.utilization ?? 0) - (sim.components[a]?.utilization ?? 0))[0];
    checks.push({
      id: `p99-${o.id}`,
      label: `${o.label}: p99 at peak`,
      status: o.reachable && !o.saturated && o.p99Ms <= traffic.p99TargetMs ? "met" : "missed",
      actual: !o.reachable ? "cut off" : o.saturated ? "no limit" : ms(o.p99Ms),
      target: `≤ ${ms(traffic.p99TargetMs)}`,
      componentIds: o.blockedBy ? [o.blockedBy] : slowest ? [slowest] : [],
      detail: o.saturated ? "A part it waits on is over capacity, so its queue keeps growing." : undefined,
    });
  }

  const bg = sim.operations.filter((o) => o.background);
  if (bg.length > 0) {
    const offered = bg.reduce((s, o) => s + o.offered, 0);
    const behind = offered > 0 ? bg.reduce((s, o) => s + o.backlog, 0) / offered : 0;
    checks.push({
      id: "keeps-up",
      label: "Background work keeps up at peak",
      status: behind <= 0.01 ? "met" : "missed",
      actual: behind <= 0.01 ? "keeping up" : `${share(behind)} behind`,
      target: "keeps up",
      componentIds: trouble(sim),
    });
  }

  // Lose one instance of each part, one at a time. Parts a provider runs are their problem, not yours.
  const breakers: { id: string; what: string }[] = [];
  const candidates = model.components.filter(
    (c) => !ROLES[c.role].managed && sim.operations.some((o) => o.route.slice(1).includes(c.id)),
  );
  for (const c of candidates) {
    const broken = simulate(injectFault(model, { kind: "kill", componentId: c.id, count: "one" }), workload, at);
    const cut = broken.operations.filter((o) => !o.background && !o.reachable).map((o) => o.label);
    const lost = failing(broken);
    if (cut.length > 0) breakers.push({ id: c.id, what: `${name(c.id)}: ${cut.join(" and ")} cut off` });
    else if (lost > ALLOWED_FAILING + 1e-12) breakers.push({ id: c.id, what: `${name(c.id)}: ${share(lost)} failing` });
  }
  checks.push({
    id: "single-failure",
    label: "Any one part loses an instance",
    status: breakers.length === 0 ? "met" : "missed",
    actual: breakers.length === 0 ? "all survive" : `${breakers.length} of ${candidates.length} break it`,
    target: "all survive",
    componentIds: breakers.map((b) => b.id),
    detail: breakers.length > 0 ? breakers.map((b) => b.what).join("; ") : undefined,
  });

  if (traffic.regions > 1) {
    const survivors = traffic.regions - 1;
    const after = simulate(model, workload, perRegion(traffic.peak, survivors));
    const lost = failing(after);
    checks.push({
      id: "region",
      label: `Lose a region: ${survivors} take its traffic`,
      status: lost <= ALLOWED_FAILING + 1e-12 ? "met" : "missed",
      actual: share(lost),
      target: "≤ 0.1%",
      componentIds: trouble(after),
    });
  } else {
    checks.push({
      id: "region",
      label: "Lose the region",
      status: "info",
      actual: "everything stops",
      target: "one region",
      componentIds: [],
      detail: "With one region, a regional outage takes the whole system down. Add a region to check failover.",
    });
  }
  return checks;
}
