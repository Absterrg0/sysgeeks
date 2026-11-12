import { describe, expect, it } from "vitest";
import { getInvestigation, listInvestigations } from "@/lib/content";
import { PLAYGROUNDS } from "@/lib/content/playground";
import { insertInFront, playModelOf, removePart, simulate, tune, type Workload } from "./playground";

function play(id: string) {
  const inv = getInvestigation(id);
  const workload = PLAYGROUNDS[id];
  if (!inv || !workload) throw new Error(`no playground for ${id}`);
  return { inv, workload, model: playModelOf(inv.system, workload) };
}

describe("playground content", () => {
  it("has a workload for every investigation, naming only its parts", () => {
    for (const inv of listInvestigations()) {
      const workload = PLAYGROUNDS[inv.id] as Workload;
      expect(workload, inv.id).toBeDefined();
      const ids = new Set(inv.system.components.map((c) => c.id));
      for (const op of workload.operations)
        for (const id of op.path) expect(ids.has(id), `${inv.id}: ${op.id} → ${id}`).toBe(true);
      for (const id of Object.keys(workload.tuning ?? {})) expect(ids.has(id), `${inv.id}: tuning ${id}`).toBe(true);
    }
  });

  // Checked over every system that has a playground, so one missing workload (reported above) does not hide
  // a broken reference design elsewhere.
  const played = () => listInvestigations().filter((inv) => PLAYGROUNDS[inv.id]);

  it("routes every operation of every reference design", () => {
    for (const inv of played()) {
      const { model, workload } = play(inv.id);
      const sim = simulate(model, workload, 1);
      for (const op of sim.operations) expect(op.reachable, `${inv.id}: ${op.id}`).toBe(true);
    }
  });

  it("keeps every reference design under capacity at average traffic", () => {
    for (const inv of played()) {
      const { model, workload } = play(inv.id);
      const sim = simulate(model, workload, 1);
      for (const [id, r] of Object.entries(sim.components)) expect(r.utilization, `${inv.id}: ${id}`).toBeLessThan(1);
    }
  });
});

describe("simulate", () => {
  it("lets a cache in front of the database take reads off it", () => {
    const { model, workload } = play("news-feed");
    const before = simulate(model, workload, 1).components.posts?.reads ?? 0;
    const cached = insertInFront(model, "posts", "cache");
    const after = simulate(cached, workload, 1).components.posts?.reads ?? 0;
    expect(after).toBeCloseTo(before * 0.1, 0);
  });

  it("does not compound hit rates: a cache behind another only answers beyond the first one's reach", () => {
    const { model, workload } = play("url-shortener");
    // Redirects pass the CDN (85%) first, so a 90% cache behind it adds only the next 5% of keys.
    const before = simulate(model, workload, 1).components.db?.reads ?? 0;
    const cached = insertInFront(model, "db", "cache");
    const sim = simulate(cached, workload, 1);
    const answered = (0.9 - 0.85) / (1 - 0.85);
    expect(sim.components.db?.reads).toBeCloseTo(before * (1 - answered), 3);
    expect(sim.components.cache?.absorbed).toBeCloseTo(before * answered, 3);
    // A cache no better than the one in front of it answers nothing.
    const weak = simulate(tune(cached, "cache", { hitRate: 0.5 }), workload, 1);
    expect(weak.components.db?.reads).toBeCloseTo(before, 3);
  });

  it("fails what has nowhere to go when a part is killed, and recovers with a spare", () => {
    const { model, workload } = play("url-shortener");
    const dead = tune(model, "db", { down: 1 });
    const redirect = simulate(dead, workload, 1).operations.find((o) => o.id === "redirect");
    expect(redirect?.reachable).toBe(false);
    expect(redirect?.failed).toBeGreaterThan(0);
    const spare = tune(tune(model, "redirect", { instances: 4 }), "redirect", { down: 1 });
    expect(simulate(spare, workload, 1).operations.find((o) => o.id === "redirect")?.reachable).toBe(true);
  });

  it("lets a replica, not a shard, take over when a database primary dies", () => {
    const { model, workload } = play("url-shortener");
    const create = (m: typeof model) => simulate(m, workload, 1).operations.find((o) => o.id === "create");
    const at = (m: typeof model) => simulate(m, workload, 1).components.db;

    // Four shards without replicas: each is still a single point of failure for its quarter of the data.
    const sharded = tune(model, "db", { instances: 4 });
    expect(at(sharded)?.spof).toBe(true);
    expect(create(sharded)?.availability).toBeCloseTo(create(model)?.availability ?? 0, 9);
    const oneShardDown = create(tune(sharded, "db", { down: 1 }));
    expect(oneShardDown?.reachable).toBe(true);
    expect((oneShardDown?.failed ?? 0) / (oneShardDown?.offered ?? 1)).toBeCloseTo(0.25, 3);

    // One primary with a replica: the replica is promoted and nothing fails.
    const replicated = tune(model, "db", { replicas: 1 });
    expect(at(replicated)?.spof).toBe(false);
    expect(create(replicated)?.availability).toBeGreaterThan(create(model)?.availability ?? 1);
    const failedOver = create(tune(replicated, "db", { down: 1 }));
    expect(failedOver?.reachable).toBe(true);
    expect(failedOver?.failed).toBe(0);

    // Losing every node, replicas included, is an outage.
    const outage = create(tune(replicated, "db", { down: 1, outage: true }));
    expect(outage?.reachable).toBe(false);
  });

  it("makes a slow part slower and busier, but not a provider's quota smaller", () => {
    const { model, workload } = play("payment-workflow");
    const charge = (m: typeof model) => simulate(m, workload, 1).operations.find((o) => o.id === "charge");
    expect(charge(tune(model, "provider", { slow: 4 }))?.latencyMs).toBeGreaterThan(5_000);
    const api = (m: typeof model) => simulate(m, workload, 14).components.api?.utilization ?? 0;
    expect(api(tune(model, "api", { slow: 3 }))).toBeCloseTo(api(model) * 3, 6);
    expect(tune(model, "api", { slow: 1 }).tuning.api?.slow).toBeUndefined();
  });

  it("marks a lone instance on a waited-on route as a single point of failure", () => {
    const { model, workload } = play("url-shortener");
    expect(simulate(model, workload, 1).components.db?.spof).toBe(true);
  });

  it("ends the wait at a queue, so slowness behind it becomes a backlog", () => {
    const { model, workload } = play("url-shortener");
    const queued = insertInFront(model, "db", "queue");
    const create = simulate(queued, workload, 1).operations.find((o) => o.id === "create");
    expect(create?.handoff).toBeDefined();
  });

  it("sheds what is over a rate limiter's limit", () => {
    const { model, workload } = play("url-shortener");
    const limited = tune(insertInFront(model, "redirect", "limiter"), "limiter", { limit: 100 });
    const sim = simulate(limited, workload, 1);
    expect(sim.components.limiter?.rejected).toBeGreaterThan(0);
    expect(sim.operations.find((o) => o.id === "redirect")?.failed).toBeGreaterThan(0);
  });

  it("puts things back when an added part is removed", () => {
    const { model, workload } = play("url-shortener");
    const back = removePart(insertInFront(model, "db", "cache"), "cache");
    expect(simulate(back, workload, 1).operations.every((o) => o.reachable)).toBe(true);
  });
});
