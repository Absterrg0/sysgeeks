import { describe, expect, it } from "vitest";
import { getExampleProject, listExampleProjects } from "@/lib/content/example-projects";
import { simulate, tune } from "./playground";
import {
  CROSS_REGION_MS,
  DEFAULT_TRAFFIC,
  paidFor,
  parseTraffic,
  perRegion,
  perSecondFromDaily,
  projectChecks,
  projectOperations,
  projectPlay,
  type ProjectTraffic,
} from "./project-play";

function example(id: string) {
  const ex = getExampleProject(id);
  if (!ex) throw new Error(`no example ${id}`);
  return ex;
}

const traffic = (patch: Partial<ProjectTraffic> = {}): ProjectTraffic => ({ ...DEFAULT_TRAFFIC, ...patch });

describe("finding operations in a drawing", () => {
  it("finds reads and writes in every example, along flows that exist", () => {
    for (const ex of listExampleProjects()) {
      const { operations } = projectOperations(ex, DEFAULT_TRAFFIC);
      const ids = operations.map((o) => o.id);
      expect(ids, ex.id).toContain("reads");
      expect(ids, ex.id).toContain("writes");
      for (const op of operations) {
        for (let i = 1; i < op.path.length; i++) {
          const a = op.path[i - 1];
          const b = op.path[i];
          const linked = ex.flows.some((f) => (f.from === a && f.to === b) || (f.from === b && f.to === a));
          expect(linked, `${ex.id}: ${op.id} ${a} → ${b}`).toBe(true);
        }
        expect(new Set(op.path).size, `${ex.id}: ${op.id} repeats a part`).toBe(op.path.length);
      }
    }
  });

  it("sends reads through the CDN the drawing puts in front, and writes straight to the database", () => {
    const { operations } = projectOperations(example("storefront"), DEFAULT_TRAFFIC);
    expect(operations.find((o) => o.id === "reads")?.path).toEqual(["web", "cdn", "api", "postgres"]);
    expect(operations.find((o) => o.id === "writes")?.path).toEqual(["web", "api", "postgres"]);
  });

  it("follows an outbox relay and a queue consumer as background work after a write", () => {
    const { operations } = projectOperations(example("storefront"), DEFAULT_TRAFFIC);
    const bg = operations.filter((o) => o.background);
    expect(bg.map((o) => o.path)).toContainEqual(["postgres", "relay", "orders", "fulfilment", "warehouse"]);
    for (const o of bg) expect(o.rps).toBe(DEFAULT_TRAFFIC.writesPerSecond);
  });

  it("starts writes where they reach a database, even when another client comes first", () => {
    const { write } = projectOperations(example("ride-hailing"), DEFAULT_TRAFFIC);
    expect(write).toEqual({ entry: "driver", target: "trips-db" });
  });

  it("honours a chosen target, and ignores one that cannot be reached", () => {
    const ex = example("storefront");
    expect(projectOperations(ex, traffic({ readTarget: "redis" })).read?.target).toBe("redis");
    expect(projectOperations(ex, traffic({ readTarget: "warehouse-that-is-not-there" })).read?.target).toBe("postgres");
  });

  it("carries payloads, and sends writes from other regions to the one primary", () => {
    const ex = example("storefront");
    const one = projectOperations(ex, traffic()).operations.find((o) => o.id === "writes");
    expect(one?.remote).toBeUndefined();
    expect(one?.payloadKB).toBe(DEFAULT_TRAFFIC.writeKB);
    const three = projectOperations(ex, traffic({ regions: 3 })).operations.find((o) => o.id === "writes");
    expect(three?.remote).toEqual({ share: 2 / 3, ms: CROSS_REGION_MS });
  });

  it("leaves out an operation with no traffic", () => {
    const ops = projectOperations(example("storefront"), traffic({ writesPerSecond: 0 })).operations;
    expect(ops.map((o) => o.id)).toEqual(["reads"]);
  });
});

describe("playing your own design", () => {
  it("routes every operation it finds in every example", () => {
    for (const ex of listExampleProjects()) {
      const { reference, workload } = projectPlay(ex, DEFAULT_TRAFFIC);
      for (const o of simulate(reference, workload, 1).operations) expect(o.reachable, `${ex.id}: ${o.id}`).toBe(true);
    }
  });

  it("splits traffic evenly across regions, and pays for each copy", () => {
    expect(perRegion(6, 3)).toBe(2);
    const { reference } = projectPlay(example("storefront"), DEFAULT_TRAFFIC);
    expect(paidFor(reference, 3)).toBe(3 * paidFor(reference, 1));
  });

  it("works out average rates from people and actions a day", () => {
    expect(perSecondFromDaily(1_000_000, 20)).toBeCloseTo(231.48, 2);
    expect(perSecondFromDaily(0, 20)).toBe(0);
    expect(perSecondFromDaily(-5, 20)).toBe(0);
  });

  it("reads stored traffic safely", () => {
    expect(parseTraffic(undefined)).toEqual(DEFAULT_TRAFFIC);
    const t = parseTraffic({ readsPerSecond: -4, peak: 1_000, regions: 2.6, readTarget: "Not An Id", writeTarget: "db" });
    expect(t.readsPerSecond).toBe(0);
    expect(t.peak).toBe(100);
    expect(t.regions).toBe(3);
    expect(t.readTarget).toBeUndefined();
    expect(t.writeTarget).toBe("db");
  });
});

describe("checks on your own design", () => {
  const status = (checks: ReturnType<typeof projectChecks>, id: string) => checks.find((c) => c.id === id);

  it("finds every single point of failure in a design drawn with one of everything", () => {
    const { reference, workload } = projectPlay(example("storefront"), DEFAULT_TRAFFIC);
    const single = status(projectChecks(reference, workload, DEFAULT_TRAFFIC), "single-failure");
    expect(single?.status).toBe("missed");
    expect(single?.componentIds).toEqual(expect.arrayContaining(["api", "postgres"]));
  });

  it("passes the single-failure check once every part on the way has a spare", () => {
    const { reference, workload } = projectPlay(example("storefront"), DEFAULT_TRAFFIC);
    let model = reference;
    for (const c of reference.components) {
      if (c.role === "database") model = tune(model, c.id, { replicas: 1 });
      else model = tune(model, c.id, { instances: 2 });
    }
    expect(status(projectChecks(model, workload, DEFAULT_TRAFFIC), "single-failure")?.status).toBe("met");
  });

  it("misses the p99 target when a part it waits on is over capacity, and says there is no limit", () => {
    const heavy = traffic({ writesPerSecond: 5_000 });
    const { reference, workload } = projectPlay(example("storefront"), heavy);
    const p99 = status(projectChecks(reference, workload, heavy), "p99-writes");
    expect(p99?.status).toBe("missed");
    expect(p99?.actual).toBe("no limit");
  });

  it("checks losing a region only when there is more than one", () => {
    const { reference, workload } = projectPlay(example("storefront"), DEFAULT_TRAFFIC);
    expect(status(projectChecks(reference, workload, DEFAULT_TRAFFIC), "region")?.status).toBe("info");
    // Two regions at a load one region cannot carry alone: losing either one overloads the other.
    const two = traffic({ regions: 2, readsPerSecond: 4_000 });
    const play = projectPlay(example("storefront"), two);
    const region = status(projectChecks(play.reference, play.workload, two), "region");
    expect(region?.status).toBe("missed");
    expect(status(projectChecks(play.reference, play.workload, two), "peak")?.status).toBe("met");
  });

  it("adds the round trip to the primary region to write latency", () => {
    const ex = example("storefront");
    const one = projectPlay(ex, traffic());
    const two = projectPlay(ex, traffic({ regions: 2 }));
    const at = (p: typeof one, r: number) =>
      simulate(p.reference, p.workload, perRegion(1, r)).operations.find((o) => o.id === "writes");
    const extra = (at(two, 2)?.latencyMs ?? 0) - (at(one, 1)?.latencyMs ?? 0);
    // Half the writes cross; each region also carries half the load, so queues are a little shorter.
    expect(extra).toBeGreaterThan(CROSS_REGION_MS / 2 - 5);
    expect(extra).toBeLessThan(CROSS_REGION_MS / 2 + 1);
  });

  it("gives the same checks for the same design every time", () => {
    const { reference, workload } = projectPlay(example("fintech-ledger"), DEFAULT_TRAFFIC);
    expect(projectChecks(reference, workload, DEFAULT_TRAFFIC)).toEqual(projectChecks(reference, workload, DEFAULT_TRAFFIC));
  });
});
