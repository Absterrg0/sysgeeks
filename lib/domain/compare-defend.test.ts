import { describe, expect, it } from "vitest";
import { getInvestigation } from "@/lib/content";
import { PLAYGROUNDS } from "@/lib/content/playground";
import { compareRows, faultOptions, measure, tradeOff } from "./compare";
import { defendQuestions } from "./defend";
import { insertInFront, playModelOf, simulate, tune } from "./playground";
import { injectFault } from "./scenarios";

function play(id: string) {
  const inv = getInvestigation(id);
  const workload = PLAYGROUNDS[id];
  if (!inv || !workload) throw new Error(`no playground for ${id}`);
  return { workload, model: playModelOf(inv.system, workload) };
}

describe("comparing two designs", () => {
  it("shows the trade-off between a replica and no replica when the primary dies", () => {
    const { model, workload } = play("url-shortener");
    const replicated = tune(model, "db", { replicas: 1 });
    const fault = faultOptions([model, replicated]).find((f) => f.id === "kill-one:db")?.fault;
    expect(fault).toBeTruthy();
    const rows = compareRows(measure(model, workload, 5, fault), measure(replicated, workload, 5, fault));
    expect(rows.find((r) => r.id === "failing")?.better).toBe("b");
    expect(rows.find((r) => r.id === "instances")?.better).toBe("a");
    expect(rows.find((r) => r.id === "spofs")?.better).toBe("b");
    expect(tradeOff(rows)).toMatch(/A does better on .*instances you pay for.*B does better on .*requests failing/);
  });

  it("calls two identical designs a draw on every row", () => {
    const { model, workload } = play("news-feed");
    const rows = compareRows(measure(model, workload, 1), measure(model, workload, 1));
    expect(rows.every((r) => r.better === null)).toBe(true);
    expect(tradeOff(rows)).toMatch(/same/);
  });

  it("treats a cut-off operation as worse than any wait", () => {
    const { model, workload } = play("url-shortener");
    const dead = injectFault(model, { kind: "kill", componentId: "db", count: "all" });
    const rows = compareRows(measure(model, workload, 1), measure(dead, workload, 1));
    const p99 = rows.find((r) => r.id === "redirect-p99");
    expect(p99?.b).toBe("cut off");
    expect(p99?.better).toBe("a");
  });

  it("offers each failure once, and an empty cache only for caches", () => {
    const { model } = play("url-shortener");
    const cached = insertInFront(model, "db", "cache");
    const options = faultOptions([model, cached]);
    expect(new Set(options.map((o) => o.id)).size).toBe(options.length);
    expect(options.some((o) => o.id === "cold:cache")).toBe(true);
    expect(options.some((o) => o.id === "cold:db")).toBe(false);
    expect(options[0]?.fault).toBeNull();
  });

  it("counts instances in every region", () => {
    const { model, workload } = play("url-shortener");
    expect(measure(model, workload, 1, null, 3).instances).toBe(3 * measure(model, workload, 1).instances);
  });
});

describe("defend-it follow-ups", () => {
  it("asks what runs out first, and the answer is the busiest part", () => {
    const { model, workload } = play("url-shortener");
    const q = defendQuestions(model, workload, 5).find((x) => x.id === "runs-out-first");
    expect(q).toBeDefined();
    const sim = simulate(model, workload, 5);
    const busiest = Object.entries(sim.components).sort((a, b) => b[1].utilization - a[1].utilization)[0]?.[0];
    expect(q?.answer).toBe(busiest);
    expect(q?.options.map((o) => o.id)).toContain(q?.answer);
  });

  it("skips 'what runs out first' when two parts are tied", () => {
    const { model, workload } = play("job-queue");
    // Four parts sit at the same utilisation in the reference design.
    expect(defendQuestions(model, workload, 2).some((q) => q.id === "runs-out-first")).toBe(false);
  });

  it("answers 'lose an instance' from the model: a spare carries it, a lone part does not", () => {
    const { model, workload } = play("url-shortener");
    const lose = (m: typeof model) => defendQuestions(m, workload, 1).find((q) => q.id === "lose-one");
    // The redirect service has four instances, so losing one changes little at average traffic.
    expect(["nothing", "slower"]).toContain(lose(model)?.answer);
    // With one of everything there is no spare anywhere, so the busiest part's loss cuts something off.
    const alone = tune(tune(tune(model, "redirect", { instances: 1 }), "api", { instances: 1 }), "aggregator", {
      instances: 1,
    });
    const q = defendQuestions(alone, workload, 1).find((x) => x.id === "lose-one");
    expect(q?.answer).toBe("cut-off");
  });

  it("asks about an empty cache when one answers reads, and the answer matches injecting it", () => {
    const { model, workload } = play("url-shortener");
    const q = defendQuestions(model, workload, 5).find((x) => x.id === "cold-cache");
    expect(q).toBeDefined();
    expect(q?.componentIds).toEqual(["cdn"]);
    const cold = simulate(injectFault(model, { kind: "cold", componentId: "cdn" }), workload, 5);
    const failing = cold.operations.some((o) => !o.background && o.failed > 0.001 * o.offered);
    expect(q?.answer === "some-fail" || q?.answer === "cut-off").toBe(failing);
  });

  it("asks about a slow part when there is no cache, and every answer is one of the options", () => {
    const { model, workload } = play("payment-workflow");
    const qs = defendQuestions(model, workload, 1);
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) expect(q.options.map((o) => o.id), q.id).toContain(q.answer);
    expect(qs.some((q) => q.id === "slow-part" || q.id === "cold-cache")).toBe(true);
  });

  it("asks the same questions with the same answers every time", () => {
    const { model, workload } = play("news-feed");
    expect(defendQuestions(model, workload, 2.4)).toEqual(defendQuestions(model, workload, 2.4));
  });
});
