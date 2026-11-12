/**
 * The playground: a system's architecture you can change and break, and a small deterministic model of
 * what that does. Requests for each operation travel a route through the parts; caches and CDNs absorb
 * reads, queues end the part a caller waits for, rate limiters shed what is over their limit, and every
 * part has a capacity, a latency and an availability. Nothing here is graded; it shows consequences.
 *
 * Pure and client-safe: the page runs it on every edit.
 */
import { percentileOf, type Branch, type Stage } from "./tail-latency";
import type { ComponentKind, FlowKind } from "./taxonomy";

/** How a part behaves under load, which is more specific than how it is drawn. */
export type Role =
  | "client"
  | "lb"
  | "cdn"
  | "limiter"
  | "service"
  | "worker"
  | "database"
  | "cache"
  | "queue"
  | "object-store"
  | "external";

/** Parts that can be put in front of another part. */
export const PARTS = ["lb", "cdn", "cache", "queue", "limiter"] as const;
export type Part = (typeof PARTS)[number];

export const PART_INFO: Record<Part, { label: string; kind: ComponentKind; responsibility: string }> = {
  lb: { label: "Load balancer", kind: "edge", responsibility: "Spreads requests across healthy instances." },
  cdn: { label: "CDN", kind: "edge", responsibility: "Serves cacheable responses from the edge, near users." },
  cache: { label: "Cache", kind: "cache", responsibility: "Answers repeated reads from memory." },
  queue: { label: "Queue", kind: "queue", responsibility: "Holds work until a consumer takes it." },
  limiter: { label: "Rate limiter", kind: "service", responsibility: "Rejects requests over a set rate." },
};

export type PlayComponent = {
  id: string;
  label: string;
  kind: ComponentKind;
  role: Role;
  responsibility: string;
  position: { col: number; row: number };
  /** Put there in the playground, not part of the reference design. */
  added?: boolean;
};

export type PlayFlow = { id: string; from: string; to: string; label: string; kind: FlowKind; added?: boolean };

export type Tuning = {
  /** Running copies. For a database, the number of primaries (shards). */
  instances: number;
  /** Database read replicas per primary. */
  replicas: number;
  /** Share of reads a cache or CDN answers itself, 0 to 1. */
  hitRate: number;
  /** Requests per second a rate limiter lets through. */
  limit: number;
  /**
   * Instances killed by the person playing. For a database, primaries: with a read replica one is promoted
   * in its place, without one that shard's data is unreachable.
   */
  down: number;
  /** Every node of it is down, replicas included. Absent means false. */
  outage?: boolean;
  /** Each request takes this many times longer than normal (a slow disk, a degraded provider). Absent means 1. */
  slow?: number;
};

export type PlayModel = { components: PlayComponent[]; flows: PlayFlow[]; tuning: Record<string, Tuning> };

export type Operation = {
  id: string;
  label: string;
  /** Average requests per second, before any traffic multiplier. */
  rps: number;
  kind: "read" | "write";
  /** A CDN may answer it. Caches answer any read. */
  cacheable?: boolean;
  /** No one waits on it, so slowness shows as a backlog rather than failed requests. */
  background?: boolean;
  /** Parts it must pass through, in order. Infrastructure added in between is found along the flows. */
  path: string[];
  /** Seconds of one instance's time each request takes at a part, when not the part's default. */
  work?: Record<string, number>;
  /** Our number, not the brief's. */
  assumed?: boolean;
  /**
   * Kilobytes each request carries. A part spends at least the time its network link takes to move them, so
   * large payloads can make a part network-bound before it runs out of anything else.
   */
  payloadKB?: number;
  /** A share of the requests that reach the end of the route cross between regions, adding a fixed round trip. */
  remote?: { share: number; ms: number };
};

/** What one instance's network link moves: 10 Gbit/s, in kilobytes a second. */
export const LINK_KB_PER_SECOND = 1_250_000;

export type Workload = {
  /** Peak traffic as a multiple of the average. */
  peak: number;
  operations: Operation[];
  /** The reference design's sizing. */
  tuning?: Record<string, Partial<Tuning>>;
  /** Requests per second one instance handles, when not the part's default. */
  capacity?: Record<string, number | { read: number; write: number }>;
  /** Milliseconds a part adds, when not the part's default. */
  latency?: Record<string, number>;
  /** Where the numbers come from. */
  note: string;
};

type RoleSpec = {
  /** Requests per second per instance; for a database, reads. */
  capacity: number;
  writeCapacity?: number;
  latency: number;
  writeLatency?: number;
  /** Per instance. */
  availability: number;
  /** Run by a provider across many machines: it scales and is not a single point of failure here. */
  managed?: boolean;
};

export const ROLES: Record<Role, RoleSpec> = {
  client: { capacity: Infinity, latency: 0, availability: 1, managed: true },
  lb: { capacity: 100_000, latency: 1, availability: 0.9999, managed: true },
  cdn: { capacity: 1_000_000, latency: 8, availability: 0.9999, managed: true },
  limiter: { capacity: 50_000, latency: 1, availability: 0.999 },
  service: { capacity: 2_000, latency: 15, availability: 0.999 },
  worker: { capacity: 1_000, latency: 0, availability: 0.999 },
  database: { capacity: 10_000, writeCapacity: 2_000, latency: 4, writeLatency: 8, availability: 0.9995 },
  cache: { capacity: 100_000, latency: 1, availability: 0.999 },
  queue: { capacity: 50_000, latency: 3, availability: 0.9999 },
  "object-store": { capacity: 1_000_000, latency: 40, availability: 0.9999, managed: true },
  external: { capacity: Infinity, latency: 300, availability: 0.995, managed: true },
};

const INFRA: ReadonlySet<Role> = new Set(["lb", "cdn", "limiter", "cache", "queue"]);

export function defaultTuning(role: Role): Tuning {
  return {
    instances: 1,
    replicas: 0,
    hitRate: role === "cdn" ? 0.8 : role === "cache" ? 0.9 : 0,
    limit: 10_000,
    down: 0,
  };
}

export function roleOf(component: { id: string; label: string; kind: ComponentKind }): Role {
  switch (component.kind) {
    case "edge":
      return /cdn/i.test(`${component.id} ${component.label}`) ? "cdn" : "lb";
    case "stream":
      return "queue";
    default:
      return component.kind;
  }
}

/** The reference design, ready to play with. */
export function playModelOf(
  system: {
    components: {
      id: string;
      label: string;
      kind: ComponentKind;
      responsibility: string;
      position: { col: number; row: number };
    }[];
    flows: { id: string; from: string; to: string; label: string; kind: FlowKind }[];
  },
  workload: Workload,
): PlayModel {
  const components = system.components.map((c) => ({
    id: c.id,
    label: c.label,
    kind: c.kind,
    role: roleOf(c),
    responsibility: c.responsibility,
    position: { ...c.position },
  }));
  const tuning = Object.fromEntries(
    components.map((c) => [c.id, { ...defaultTuning(c.role), ...workload.tuning?.[c.id] }]),
  );
  return { components, flows: system.flows.map((f) => ({ ...f })), tuning };
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/** Which parts make sense in front of a part with this role. */
export function partsFor(role: Role): Part[] {
  switch (role) {
    case "service":
      return ["lb", "cdn", "cache", "queue", "limiter"];
    case "lb":
      return ["cdn", "limiter"];
    case "worker":
      return ["queue"];
    case "database":
      return ["cache", "queue"];
    case "object-store":
      return ["cdn", "cache"];
    case "external":
      return ["queue", "limiter"];
    default:
      return [];
  }
}

function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Puts a part in front of `targetId`: everything that called the target now calls the part, and the part
 * calls the target. Parts to the right make room by moving one column over.
 */
export function insertInFront(model: PlayModel, targetId: string, part: Part): PlayModel {
  const target = model.components.find((c) => c.id === targetId);
  if (!target) return model;
  const info = PART_INFO[part];
  const taken = new Set(model.components.map((c) => c.id));
  const id = uniqueId(part, taken);
  const flowIds = new Set(model.flows.map((f) => f.id));
  const { col, row } = target.position;

  const components: PlayComponent[] = [
    ...model.components.map((c) =>
      c.position.col >= col ? { ...c, position: { col: c.position.col + 1, row: c.position.row } } : c,
    ),
    {
      id,
      label: info.label,
      kind: info.kind,
      role: part,
      responsibility: info.responsibility,
      position: { col, row },
      added: true,
    },
  ];
  const flows: PlayFlow[] = model.flows.map((f) => (f.to === targetId && f.kind !== "data" ? { ...f, to: id } : f));
  const inner = uniqueId(`${id}-to-${targetId}`, flowIds);
  flows.push({
    id: inner,
    from: id,
    to: targetId,
    label: part === "queue" ? "Delivers work" : "Forwards requests",
    kind: part === "queue" ? "async" : "request",
    added: true,
  });
  return { components, flows, tuning: { ...model.tuning, [id]: defaultTuning(part) } };
}

/**
 * Removes a part and its flows. An added part is lifted out cleanly: whatever called it calls what it
 * was in front of again.
 */
export function removePart(model: PlayModel, id: string): PlayModel {
  const part = model.components.find((c) => c.id === id);
  if (!part) return model;
  const onward = part.added ? model.flows.find((f) => f.from === id && f.added) : undefined;
  const flows = model.flows.flatMap((f) => {
    if (onward && f.to === id) return [{ ...f, to: onward.to }];
    if (f.from === id || f.to === id) return [];
    return [f];
  });
  const tuning = { ...model.tuning };
  delete tuning[id];
  return { components: model.components.filter((c) => c.id !== id), flows, tuning };
}

export function tune(model: PlayModel, id: string, patch: Partial<Tuning>): PlayModel {
  const current = model.tuning[id];
  if (!current) return model;
  const next: Tuning = { ...current, ...patch };
  next.instances = Math.max(1, Math.round(next.instances));
  next.replicas = Math.max(0, Math.round(next.replicas));
  next.down = Math.min(Math.max(0, Math.round(next.down)), next.instances);
  next.hitRate = Math.min(0.99, Math.max(0, next.hitRate));
  next.limit = Math.max(1, Math.round(next.limit));
  if (!next.outage) delete next.outage;
  if (next.slow === undefined || !(next.slow > 1)) delete next.slow;
  else next.slow = Math.min(100, next.slow);
  return { ...model, tuning: { ...model.tuning, [id]: next } };
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

export type Status = "idle" | "ok" | "hot" | "over" | "down";

export type ComponentResult = {
  reads: number;
  writes: number;
  /** Instances still running. */
  alive: number;
  /** Share of capacity in use; above 1 means more arrives than it can handle. */
  utilization: number;
  status: Status;
  /** On a route someone waits on, with nothing to take over if its one instance dies. */
  spof: boolean;
  /** Requests per second answered here instead of passed on. */
  absorbed: number;
  /** Requests per second turned away by a rate limiter. */
  rejected: number;
  /**
   * Share of the requests reaching it that fail because the node holding their data is dead: a database shard
   * with no replica to take over.
   */
  lost: number;
};

export type OperationResult = {
  id: string;
  label: string;
  route: string[];
  reachable: boolean;
  /** The part that cut the route, when it is cut. */
  blockedBy?: string;
  offered: number;
  /** Requests per second that complete. */
  served: number;
  /** Requests per second that fail: rejected, timed out or with nowhere to go. */
  failed: number;
  /** Background work per second that piles up instead of being done. */
  backlog: number;
  /** Expected time a caller waits, in milliseconds. */
  latencyMs: number;
  /** The time 99 in 100 callers finish within, in milliseconds (see `tail-latency.ts` for the assumptions). */
  p99Ms: number;
  /** A part the caller waits on gets more than it can handle, so its queue grows and the wait has no limit. */
  saturated: boolean;
  availability: number;
  background: boolean;
  /** Index in the route where the caller stops waiting (a queue), if any. */
  handoff?: number;
};

export type Simulation = {
  components: Record<string, ComponentResult>;
  operations: OperationResult[];
  /** Requests per second carried by each flow. */
  flows: Record<string, number>;
  /** Running instances of everything not run by a provider: a rough measure of cost. */
  instances: number;
};

function capacityOf(c: PlayComponent, workload: Workload, write: boolean): number {
  const override = workload.capacity?.[c.id];
  if (typeof override === "number") return override;
  if (override) return write ? override.write : override.read;
  const spec = ROLES[c.role];
  return write ? (spec.writeCapacity ?? spec.capacity) : spec.capacity;
}

function latencyOf(c: PlayComponent, workload: Workload, write: boolean): number {
  const override = workload.latency?.[c.id];
  if (override !== undefined) return override;
  const spec = ROLES[c.role];
  return write ? (spec.writeLatency ?? spec.latency) : spec.latency;
}

/** Shortest way from one part to another through infrastructure only, ignoring flow direction. */
function findWay(
  from: string,
  to: string,
  adjacent: Map<string, string[]>,
  byId: Map<string, PlayComponent>,
): string[] | null {
  const previous = new Map<string, string>([[from, from]]);
  const queue = [from];
  while (queue.length > 0) {
    const at = queue.shift() as string;
    if (at === to) break;
    for (const next of adjacent.get(at) ?? []) {
      if (previous.has(next)) continue;
      const role = byId.get(next)?.role;
      if (next !== to && (!role || !INFRA.has(role))) continue;
      previous.set(next, at);
      queue.push(next);
    }
  }
  if (!previous.has(to)) return null;
  const way = [to];
  while (way[0] !== from) way.unshift(previous.get(way[0] as string) as string);
  return way;
}

export function simulate(model: PlayModel, workload: Workload, traffic: number): Simulation {
  const byId = new Map(model.components.map((c) => [c.id, c]));
  const tuningOf = (id: string) => model.tuning[id] ?? defaultTuning(byId.get(id)?.role ?? "service");
  const slowOf = (id: string) => Math.max(1, tuningOf(id).slow ?? 1);
  const databaseOf = (id: string) => databaseState(tuningOf(id));
  /** Instances still working; for a database, shards that can still be reached. */
  const aliveOf = (id: string) => {
    const t = tuningOf(id);
    if (t.outage) return 0;
    if (byId.get(id)?.role === "database") return databaseOf(id).shards;
    return Math.max(0, t.instances - t.down);
  };
  // A dead cache is still in the way, but every read falls through it to what it fronts.
  const passable = (id: string) => aliveOf(id) > 0 || byId.get(id)?.role === "cache";
  const adjacent = new Map<string, string[]>();
  for (const f of model.flows) {
    if (!passable(f.from) || !passable(f.to)) continue;
    adjacent.set(f.from, [...(adjacent.get(f.from) ?? []), f.to]);
    adjacent.set(f.to, [...(adjacent.get(f.to) ?? []), f.from]);
  }
  const flowBetween = (a: string, b: string) =>
    model.flows.find((f) => (f.from === a && f.to === b) || (f.from === b && f.to === a))?.id;

  // Routes first: they do not depend on load.
  const routes = workload.operations.map((op) => {
    const missing = op.path.find((id) => !byId.has(id) || !passable(id));
    if (missing) return { op, route: [] as string[], blockedBy: missing };
    // A dead cache passes reads on to what it fronts. When an operation ends at the cache, it fronts nothing:
    // the cache is where that data lives, so with it gone there is nowhere to go.
    const end = op.path.at(-1) as string;
    if (byId.get(end)?.role === "cache" && aliveOf(end) === 0) return { op, route: [] as string[], blockedBy: end };
    let route = [op.path[0] as string];
    for (let i = 1; i < op.path.length; i++) {
      const way = findWay(op.path[i - 1] as string, op.path[i] as string, adjacent, byId);
      if (!way) return { op, route: [] as string[], blockedBy: op.path[i] };
      route = [...route, ...way.slice(1)];
    }
    return { op, route, blockedBy: undefined };
  });

  const absorbs = (c: PlayComponent, op: Operation) =>
    aliveOf(c.id) > 0 && ((c.role === "cdn" && op.cacheable) || (c.role === "cache" && op.kind === "read"));
  /**
   * What share of the reads arriving at a cache it answers. Hit rate is what a cache would answer on its own;
   * behind another cache it only sees that cache's misses, and the popular keys it would have held were
   * already answered upstream, so it answers only what lies beyond the first one's reach.
   */
  const shareAnswered = (c: PlayComponent, op: Operation, covered: number) => {
    if (!absorbs(c, op)) return 0;
    const h = tuningOf(c.id).hitRate;
    return covered >= 1 ? 0 : Math.max(0, (h - covered) / (1 - covered));
  };

  // Rate limiters shed in proportion across everything that reaches them, so total what they are offered first.
  const offeredAt = new Map<string, number>();
  const walk = (
    op: Operation,
    route: string[],
    limiterShare: (id: string) => number,
    visit: (id: string, load: number, index: number, answered: number) => void,
  ) => {
    let load = op.rps * traffic;
    let covered = 0;
    route.forEach((id, index) => {
      const c = byId.get(id);
      if (!c) return;
      if (c.role === "limiter") load *= limiterShare(id);
      const answered = shareAnswered(c, op, covered);
      visit(id, load, index, answered);
      if (absorbs(c, op)) {
        load *= 1 - answered;
        covered = Math.max(covered, tuningOf(id).hitRate);
      }
    });
  };
  for (const { op, route } of routes) {
    walk(
      op,
      route,
      () => 1,
      (id, load) => {
        if (byId.get(id)?.role === "limiter") offeredAt.set(id, (offeredAt.get(id) ?? 0) + load);
      },
    );
  }
  const limiterShare = (id: string) => {
    const offered = offeredAt.get(id) ?? 0;
    return offered > 0 ? Math.min(1, tuningOf(id).limit / offered) : 1;
  };

  // Load and busy time at every part.
  const results: Record<string, ComponentResult> = {};
  const readBusy = new Map<string, number>();
  const writeBusy = new Map<string, number>();
  const flows: Record<string, number> = {};
  for (const c of model.components) {
    results[c.id] = {
      reads: 0,
      writes: 0,
      alive: aliveOf(c.id),
      utilization: 0,
      status: "idle",
      spof: false,
      absorbed: 0,
      rejected: 0,
      lost: c.role === "database" ? databaseOf(c.id).lost : 0,
    };
  }
  for (const { op, route } of routes) {
    const write = op.kind === "write";
    let previous: string | undefined;
    walk(op, route, limiterShare, (id, load, index, answered) => {
      const r = results[id];
      const c = byId.get(id);
      if (!r || !c) return;
      if (previous) {
        const flow = flowBetween(previous, id);
        if (flow) flows[flow] = (flows[flow] ?? 0) + load;
      }
      previous = id;
      // The part an operation starts from sends it; its own work is counted by whatever reaches it.
      if (index === 0 || c.role === "client") return;
      if (write) r.writes += load;
      else r.reads += load;
      // A slow part spends longer on each request; a provider's quota is the same however slowly it answers.
      const slowdown = ROLES[c.role].managed ? 1 : slowOf(id);
      const perRequest = op.work?.[id] ?? 1 / capacityOf(c, workload, write);
      // Moving the payload takes the link at least this long, whatever else the part does.
      const onTheWire = ROLES[c.role].managed ? 0 : (op.payloadKB ?? 0) / LINK_KB_PER_SECOND;
      const cost = Math.max(perRequest, onTheWire) * slowdown;
      const busy = write ? writeBusy : readBusy;
      busy.set(id, (busy.get(id) ?? 0) + load * cost);
      r.absorbed += load * answered;
    });
  }
  for (const [id, offered] of offeredAt) {
    const r = results[id];
    if (r) r.rejected = Math.max(0, offered - tuningOf(id).limit);
  }

  for (const c of model.components) {
    const r = results[c.id] as ComponentResult;
    const t = tuningOf(c.id);
    if (c.role === "client") continue;
    let utilization: number;
    if (ROLES[c.role].managed) {
      utilization = ((readBusy.get(c.id) ?? 0) + (writeBusy.get(c.id) ?? 0)) / Math.max(1, t.instances);
    } else if (c.role === "database") {
      // Every shard holds its own share of the data, so each carries 1/instances of the load whether or not
      // the others are up; replicas share a shard's reads, and a promoted replica takes its primary's writes.
      const db = databaseOf(c.id);
      utilization =
        db.shards === 0
          ? 0
          : Math.max(
              (readBusy.get(c.id) ?? 0) / (t.replicas > 0 ? db.readNodes : t.instances),
              (writeBusy.get(c.id) ?? 0) / t.instances,
            );
    } else {
      utilization = r.alive === 0 ? 0 : ((readBusy.get(c.id) ?? 0) + (writeBusy.get(c.id) ?? 0)) / r.alive;
    }
    r.utilization = utilization;
    r.status =
      r.alive === 0
        ? "down"
        : r.reads + r.writes === 0
          ? "idle"
          : utilization >= 1
            ? "over"
            : utilization >= 0.7
              ? "hot"
              : "ok";
  }

  // What each operation gets.
  const operations: OperationResult[] = routes.map(({ op, route, blockedBy }) => {
    const offered = op.rps * traffic;
    const background = Boolean(op.background);
    if (blockedBy) {
      return {
        id: op.id,
        label: op.label,
        route,
        reachable: false,
        blockedBy,
        offered,
        served: 0,
        failed: background ? 0 : offered,
        backlog: background ? offered : 0,
        latencyMs: 0,
        p99Ms: 0,
        saturated: false,
        availability: 0,
        background,
      };
    }
    let reaching = 1;
    let waited = !background;
    let latencyMs = 0;
    let availability = 1;
    let served = 1;
    let backlogShare = 0;
    let covered = 0;
    let handoff: number | undefined;
    let saturated = false;
    // The trips a request can take: one per place a cache or CDN can answer it, plus the full route.
    const branches: Branch[] = [];
    const stages: Stage[] = [];
    route.forEach((id, index) => {
      const c = byId.get(id) as PlayComponent;
      const r = results[id] as ComponentResult;
      const t = tuningOf(id);
      if (index === 0 || c.role === "client") return;
      if (c.role === "limiter") served *= limiterShare(id);
      const write = op.kind === "write";
      const keepUp = r.utilization > 1 ? 1 / r.utilization : 1;
      if (waited) {
        const queueing = 1 / (1 - Math.min(r.utilization, 0.9));
        const meanMs = latencyOf(c, workload, write) * slowOf(id) * (ROLES[c.role].managed ? 1 : queueing);
        latencyMs += reaching * meanMs;
        stages.push({ meanMs });
        if (!ROLES[c.role].managed && r.utilization >= 1 && reaching > 0) saturated = true;
        const spec = ROLES[c.role];
        const perInstance = spec.availability;
        // Copies only help availability when another can take over a request. Shards cannot: each holds
        // different data. A shard's replicas can, by being promoted.
        const copies = c.role === "database" ? 1 + t.replicas : Math.max(r.alive, 0);
        const up = spec.managed ? perInstance : 1 - (1 - perInstance) ** copies;
        // A cache that fails sends its reads on to what it fronts rather than failing them.
        if (c.role !== "cache") availability *= up;
        if (!spec.managed && c.role !== "cache" && (c.role === "database" ? t.replicas === 0 : r.alive === 1)) {
          r.spof = true;
        }
        served *= keepUp * (1 - r.lost);
      } else {
        backlogShare = Math.max(backlogShare, 1 - keepUp * (1 - r.lost));
      }
      if (absorbs(c, op)) {
        const answered = shareAnswered(c, op, covered);
        if (waited) branches.push({ weight: reaching * answered, stages: [...stages] });
        reaching *= 1 - answered;
        covered = Math.max(covered, t.hitRate);
      }
      if (c.role === "queue" && waited) {
        waited = false;
        handoff = index;
      }
    });
    // Requests that reach the end of the route; some may cross to another region and back.
    const remote = op.remote && op.remote.share > 0 && op.remote.ms > 0 ? op.remote : undefined;
    if (remote) {
      branches.push({ weight: reaching * (1 - remote.share), stages: [...stages] });
      branches.push({ weight: reaching * remote.share, stages: [...stages, { fixedMs: remote.ms }] });
      latencyMs += reaching * remote.share * remote.ms;
    } else {
      branches.push({ weight: reaching, stages: [...stages] });
    }
    return {
      id: op.id,
      label: op.label,
      route,
      reachable: true,
      offered,
      served: background ? offered * (1 - backlogShare) * served : offered * served,
      failed: background ? 0 : offered * (1 - served),
      backlog: offered * (background ? Math.max(backlogShare, 1 - served) : backlogShare),
      latencyMs: background ? 0 : latencyMs,
      p99Ms: background ? 0 : percentileOf(branches),
      saturated: !background && saturated,
      availability,
      background,
      handoff,
    };
  });

  const instances = model.components.reduce((sum, c) => {
    if (ROLES[c.role].managed) return sum;
    if (c.role === "database") return sum + databaseOf(c.id).nodes;
    return sum + aliveOf(c.id);
  }, 0);

  return { components: results, operations, flows, instances };
}

/**
 * A database as primaries (one per shard) and read replicas. A dead primary with a replica is replaced by
 * promoting it; without one, the data on that shard cannot be read or written until it comes back.
 */
export function databaseState(t: Tuning): {
  /** Shards that can still serve their data. */
  shards: number;
  /** Nodes that can serve reads. */
  readNodes: number;
  /** Nodes running. */
  nodes: number;
  /** Share of requests whose data is on a shard that is gone. */
  lost: number;
} {
  if (t.outage) return { shards: 0, readNodes: 0, nodes: 0, lost: 1 };
  const down = Math.min(t.down, t.instances);
  if (t.replicas > 0) {
    const nodes = t.instances * (1 + t.replicas) - down;
    return { shards: t.instances, readNodes: nodes, nodes, lost: 0 };
  }
  const shards = t.instances - down;
  return { shards, readNodes: shards, nodes: shards, lost: shards === 0 ? 1 : down / t.instances };
}

/** Traffic levels to play at, as multiples of the average. */
export function trafficLevels(workload: Workload) {
  return [
    { id: "average", label: "Average", multiplier: 1 },
    { id: "peak", label: `Peak ×${workload.peak}`, multiplier: workload.peak },
    { id: "growth", label: "10× growth", multiplier: workload.peak * 10 },
  ] as const;
}
