import { describe, expect, it } from "vitest";
import { getInvestigation, listConcepts, listWriteups } from "@/lib/content";
import { PLAYGROUNDS } from "@/lib/content/playground";
import { SCENARIOS } from "@/lib/content/scenarios";
import { playModelOf, tune } from "./playground";
import {
  applyEdits,
  checkScenario,
  injectFault,
  parseScenarioProgress,
  provisioned,
  recordReveal,
  recordSolve,
  scenarioDueAt,
  startOf,
  type Edit,
  type Scenario,
} from "./scenarios";

function setup(scenario: Scenario) {
  const inv = getInvestigation(scenario.investigationId);
  const workload = PLAYGROUNDS[scenario.investigationId];
  if (!inv || !workload) throw new Error(`no playground for ${scenario.investigationId}`);
  const reference = playModelOf(inv.system, workload);
  return { inv, workload, reference, start: startOf(reference, scenario) };
}

function check(scenario: Scenario, edits: Edit[]) {
  const { workload, reference, start } = setup(scenario);
  return checkScenario({ model: applyEdits(start, edits), reference, workload, scenario });
}

const summary = (c: ReturnType<typeof check>) => c.goals.map((g) => `${g.goal.kind}: ${g.actual} (${g.target})`).join("; ");

describe("scenario content", () => {
  it("has unique ids and refers only to real systems, parts, operations, concepts and writeups", () => {
    const keys = new Set<string>();
    const concepts = new Set(listConcepts().map((c) => c.id));
    const writeups = new Map(listWriteups().map((w) => [w.id, w]));
    for (const s of SCENARIOS) {
      const key = `${s.investigationId}/${s.id}`;
      expect(keys.has(key), key).toBe(false);
      keys.add(key);
      const { workload, start } = setup(s);
      const parts = new Set(start.components.map((c) => c.id));
      const ops = new Set(workload.operations.map((o) => o.id));
      for (const id of Object.keys(s.surge ?? {})) expect(ops.has(id), `${key}: surge ${id}`).toBe(true);
      for (const f of s.faults ?? []) expect(parts.has(f.componentId), `${key}: fault ${f.componentId}`).toBe(true);
      for (const f of s.frozen ?? []) expect(parts.has(f.componentId), `${key}: frozen ${f.componentId}`).toBe(true);
      for (const g of s.goals) {
        if (g.kind === "served" || g.kind === "keeps-up")
          for (const op of g.ops) expect(ops.has(op), `${key}: goal op ${op}`).toBe(true);
        if (g.kind === "wait") expect(ops.has(g.op), `${key}: goal op ${g.op}`).toBe(true);
        if (g.kind === "served" && g.when) expect(parts.has(g.when.componentId), `${key}: when`).toBe(true);
      }
      for (const h of s.hints)
        for (const id of h.componentIds ?? []) expect(parts.has(id), `${key}: hint ${id}`).toBe(true);
      for (const id of s.debrief.conceptIds) expect(concepts.has(id), `${key}: concept ${id}`).toBe(true);
      expect(s.debrief.sourceIds.length, `${key}: needs a source`).toBeGreaterThan(0);
      for (const id of s.debrief.sourceIds) expect(writeups.has(id), `${key}: source ${id}`).toBe(true);
      expect(s.hints.length, `${key}: hints`).toBeGreaterThanOrEqual(2);
    }
  });

  it("starts every scenario failing, so there is something to do", () => {
    for (const s of SCENARIOS) {
      const result = check(s, []);
      expect(result.passed, `${s.investigationId}/${s.id} passes untouched: ${summary(result)}`).toBe(false);
    }
  });

  it("has an answer that passes every scenario", () => {
    for (const s of SCENARIOS) {
      const result = check(s, s.solution);
      expect(result.passed, `${s.investigationId}/${s.id}: ${summary(result)}`).toBe(true);
    }
  });

  it("does not let a frozen setting be changed to pass", () => {
    const s = SCENARIOS.find((x) => x.id === "campaign-launch") as Scenario;
    const cheat = check(s, [{ tune: "cdn", set: { hitRate: 0.99 } }]);
    const untouched = check(s, []);
    expect(cheat.passed).toBe(false);
    expect(cheat.sim.components.redirect?.reads).toBeCloseTo(untouched.sim.components.redirect?.reads ?? 0, 6);
  });

  it("checks a failure goal against the design with the fault added, not the design alone", () => {
    const s = SCENARIOS.find((x) => x.id === "shard-dies") as Scenario;
    const more = check(s, [{ tune: "shards", set: { instances: 16 } }]);
    const survive = more.goals.find((g) => g.goal.kind === "served" && g.goal.when);
    expect(survive?.met).toBe(false);
    expect(survive?.componentIds).toContain("shards");
  });
});

describe("checkScenario", () => {
  it("counts killed instances in the budget: you still pay for them", () => {
    const s = SCENARIOS.find((x) => x.id === "primary-dies") as Scenario;
    const { reference } = setup(s);
    expect(provisioned(tune(reference, "api", { down: 1 }))).toBe(provisioned(reference));
  });

  it("applies the situation's faults to whatever design is checked", () => {
    const s = SCENARIOS.find((x) => x.id === "slow-provider") as Scenario;
    const result = check(s, []);
    expect(result.model.tuning.provider?.slow).toBe(8);
    expect(result.goals[0]?.met).toBe(false);
  });

  it("kills a database's primary, or every node of it", () => {
    const s = SCENARIOS.find((x) => x.id === "primary-dies") as Scenario;
    const { reference } = setup(s);
    expect(injectFault(reference, { kind: "kill", componentId: "postgres", count: "one" }).tuning.postgres?.down).toBe(
      1,
    );
    expect(
      injectFault(reference, { kind: "kill", componentId: "postgres", count: "all" }).tuning.postgres?.outage,
    ).toBe(true);
    expect(injectFault(reference, { kind: "cold", componentId: "missing" })).toBe(reference);
  });
});

describe("scenario progress", () => {
  const key = "url-shortener/campaign-launch";
  it("records the first solve, then a review only once it is due", () => {
    let p = recordSolve({}, key, "2026-11-01T10:00:00.000Z");
    expect(p[key]?.solvedAt).toBe("2026-11-01T10:00:00.000Z");
    expect(scenarioDueAt(p[key])?.toISOString()).toBe("2026-11-04T10:00:00.000Z");
    expect(recordSolve(p, key, "2026-11-02T10:00:00.000Z")).toBe(p);
    p = recordSolve(p, key, "2026-11-05T10:00:00.000Z");
    expect(p[key]?.resolvedAt).toEqual(["2026-11-05T10:00:00.000Z"]);
    expect(scenarioDueAt(p[key])?.toISOString()).toBe("2026-11-15T10:00:00.000Z");
  });

  it("marks an answer shown before solving, and keeps the solve when it comes", () => {
    const p = recordReveal({}, key, "2026-11-01T10:00:00.000Z");
    expect(p[key]?.revealedAt).toBeDefined();
    expect(scenarioDueAt(p[key])).toBeUndefined();
    expect(recordSolve(p, key, "2026-11-01T11:00:00.000Z")[key]?.solvedAt).toBeDefined();
  });

  it("reads back only well-formed records", () => {
    expect(parseScenarioProgress(null)).toBeUndefined();
    expect(parseScenarioProgress([1])).toBeUndefined();
    expect(
      parseScenarioProgress({
        [key]: { solvedAt: "2026-11-01T10:00:00.000Z", resolvedAt: ["nope", "2026-11-05T10:00:00.000Z"] },
        "Bad Key": { solvedAt: "2026-11-01T10:00:00.000Z" },
        "a/b": { solvedAt: 5 },
      }),
    ).toEqual({ [key]: { solvedAt: "2026-11-01T10:00:00.000Z", resolvedAt: ["2026-11-05T10:00:00.000Z"] } });
  });
});
