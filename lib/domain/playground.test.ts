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

  it("routes every operation of every reference design", () => {
    for (const inv of listInvestigations()) {
      const { model, workload } = play(inv.id);
      const sim = simulate(model, workload, 1);
      for (const op of sim.operations) expect(op.reachable, `${inv.id}: ${op.id}`).toBe(true);
    }
  });

  it("keeps every reference design under capacity at average traffic", () => {
    for (const inv of listInvestigations()) {
      const { model, workload } = play(inv.id);
      const sim = simulate(model, workload, 1);
      for (const [id, r] of Object.entries(sim.components)) expect(r.utilization, `${inv.id}: ${id}`).toBeLessThan(1);
    }
  });
});

describe("simulate", () => {
  it("lets a cache in front of the database take reads off it", () => {
    const { model, workload } = play("url-shortener");
    const before = simulate(model, workload, 50).components.db?.reads ?? 0;
    const cached = insertInFront(model, "db", "cache");
    const after = simulate(cached, workload, 50).components.db?.reads ?? 0;
    expect(after).toBeCloseTo(before * 0.1, 0);
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
