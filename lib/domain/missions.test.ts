import { describe, expect, it } from "vitest";
import { getInvestigation, listConcepts, listInvestigations, listWriteups } from "@/lib/content";
import { PLAYGROUNDS } from "@/lib/content/playground";
import { listMissions, missionsFor, scenariosFor } from "@/lib/content/scenarios";
import { solveFor } from "./missions";
import { playModelOf, simulate } from "./playground";
import { applyEdits, checkScenario, startOf, type Scenario } from "./scenarios";

const systems = listInvestigations().filter((inv) => PLAYGROUNDS[inv.id]);

function setup(investigationId: string) {
  const inv = getInvestigation(investigationId);
  const workload = PLAYGROUNDS[investigationId];
  if (!inv || !workload) throw new Error(`no playground for ${investigationId}`);
  return { workload, reference: playModelOf(inv.system, workload) };
}

function check(s: Scenario, withSolution: boolean) {
  const { workload, reference } = setup(s.investigationId);
  const model = applyEdits(startOf(reference, s), withSolution ? s.solution : []);
  return checkScenario({ model, reference, workload, scenario: s });
}

const generated = (id: string) => missionsFor(id).slice(scenariosFor(id).length);

describe("missions", () => {
  it("gives every playground system at least two", () => {
    for (const inv of systems) expect(missionsFor(inv.id).length, inv.id).toBeGreaterThanOrEqual(2);
  });

  it("keeps the hand-written scenarios first and ids unique per system", () => {
    for (const inv of systems) {
      const all = missionsFor(inv.id);
      expect(all.slice(0, scenariosFor(inv.id).length)).toEqual(scenariosFor(inv.id));
      const ids = all.map((s) => s.id);
      expect(new Set(ids).size, inv.id).toBe(ids.length);
    }
    expect(listMissions().length).toBe(systems.reduce((n, inv) => n + missionsFor(inv.id).length, 0));
  });

  it("starts every generated mission failing and its answer passing", () => {
    for (const inv of systems) {
      for (const s of generated(inv.id)) {
        const key = `${inv.id}/${s.id}`;
        expect(check(s, false).passed, `${key} passes before any change`).toBe(false);
        const after = check(s, true);
        expect(after.passed, `${key}: ${after.goals.map((g) => `${g.goal.kind} ${g.actual} (${g.target})`).join("; ")}`).toBe(true);
      }
    }
  });

  it("refers only to real parts, operations, concepts and writeups", () => {
    const concepts = new Set(listConcepts().map((c) => c.id));
    const writeups = new Set(listWriteups().map((w) => w.id));
    for (const inv of systems) {
      const { workload, reference } = setup(inv.id);
      const parts = new Set(reference.components.map((c) => c.id));
      const ops = new Set(workload.operations.map((o) => o.id));
      for (const s of generated(inv.id)) {
        const key = `${inv.id}/${s.id}`;
        expect(s.investigationId).toBe(inv.id);
        for (const id of s.debrief.conceptIds) expect(concepts.has(id), `${key}: concept ${id}`).toBe(true);
        for (const id of s.debrief.sourceIds) expect(writeups.has(id), `${key}: source ${id}`).toBe(true);
        for (const h of s.hints) for (const id of h.componentIds ?? []) expect(parts.has(id), `${key}: hint ${id}`).toBe(true);
        for (const e of [...s.solution, ...(s.start ?? [])]) if ("tune" in e) expect(parts.has(e.tune), `${key}: ${e.tune}`).toBe(true);
        for (const g of s.goals) {
          if (g.kind === "served" || g.kind === "keeps-up") for (const op of g.ops) expect(ops.has(op), `${key}: ${op}`).toBe(true);
          if (g.kind === "served" && g.when) expect(parts.has(g.when.componentId), `${key}: when`).toBe(true);
        }
        const words = [s.title, s.summary, s.situation, ...s.hints.map((h) => h.text), ...Object.values(s.debrief).flat()];
        for (const w of words) expect(String(w), key).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });

  it("simulates the answers without NaN", () => {
    for (const inv of systems) {
      const { workload, reference } = setup(inv.id);
      for (const s of generated(inv.id)) {
        const sim = simulate(applyEdits(startOf(reference, s), s.solution), workload, s.traffic);
        for (const r of Object.values(sim.components)) expect(Number.isFinite(r.utilization), `${inv.id}/${s.id}`).toBe(true);
        for (const o of sim.operations) expect(Number.isFinite(o.latencyMs + o.p99Ms + o.failed), `${inv.id}/${s.id}`).toBe(true);
      }
    }
  });
});

describe("solveFor", () => {
  it("only adds capacity, and gives up on what scaling cannot fix", () => {
    const { workload, reference } = setup("url-shortener");
    const solve = solveFor(reference, workload, {
      traffic: workload.peak * 10,
      goals: [{ kind: "served", ops: ["redirect"], maxFailing: 0.01 }],
    });
    expect(solve).not.toBeNull();
    for (const e of solve?.edits ?? []) {
      if (!("tune" in e)) throw new Error("solver should only tune");
      const before = reference.tuning[e.tune];
      expect((e.set.instances ?? before?.instances ?? 0) >= (before?.instances ?? 0)).toBe(true);
    }
    // The email provider's quota is fixed; no number of machines on our side sends more email.
    const n = setup("notification-system");
    const email = solveFor(n.reference, n.workload, {
      traffic: n.workload.peak * 10,
      goals: [{ kind: "keeps-up", ops: ["email"] }],
    });
    expect(email).toBeNull();
  });
});
