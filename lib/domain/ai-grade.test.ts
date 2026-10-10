import { describe, expect, it } from "vitest";
import type { Grade } from "../ai/schemas";
import type { RubricPoint } from "./content";
import { toAiAssessment } from "./ai-grade";

const rubric: RubricPoint[] = [
  { id: "mechanism", text: "Says how the write is acknowledged.", weight: "core" },
  { id: "failover", text: "Says what happens on failover.", weight: "supporting" },
  { id: "cost", text: "Names the latency cost.", weight: "supporting" },
];
const passages = ["Writes go to the primary.", "Replicas catch up asynchronously."];
const meta = { runId: "run-1", model: "fast-model", now: "2026-01-01T00:00:00.000Z" };

function grade(points: Grade["points"], summary = "Solid start."): Grade {
  return { points, summary };
}

describe("toAiAssessment", () => {
  it("cites the passage for covered and partial points", () => {
    const result = toAiAssessment(
      grade([
        { id: "mechanism", mark: "covered", passage: 0, note: "" },
        { id: "failover", mark: "partial", passage: 1, note: "Says replicas lag but not the cost." },
        { id: "cost", mark: "missed", passage: null, note: "Latency is never mentioned." },
      ]),
      rubric,
      passages,
      meta,
    );
    expect(result.marks).toEqual({ mechanism: "covered", failover: "partial", cost: "missed" });
    expect(result.citations).toEqual({ mechanism: passages[0], failover: passages[1] });
    expect(result.notes.failover).toBe("Says replicas lag but not the cost.");
    expect(result.summary).toBe("Solid start.");
  });

  it("downgrades a covered point with a fake passage index to missed", () => {
    const result = toAiAssessment(
      grade([{ id: "mechanism", mark: "covered", passage: 7, note: "Looks right." }]),
      rubric,
      passages,
      meta,
    );
    expect(result.marks.mechanism).toBe("missed");
    expect(result.notes.mechanism).toBe("No supporting passage");
    expect(result.citations).not.toHaveProperty("mechanism");
  });

  it("downgrades a partial point with no passage to missed", () => {
    const result = toAiAssessment(
      grade([{ id: "failover", mark: "partial", passage: null, note: "Vague." }]),
      rubric,
      passages,
      meta,
    );
    expect(result.marks.failover).toBe("missed");
    expect(result.notes.failover).toBe("No supporting passage");
  });

  it("marks rubric points the grade leaves out as missed", () => {
    const result = toAiAssessment(
      grade([{ id: "mechanism", mark: "covered", passage: 0, note: "" }]),
      rubric,
      passages,
      meta,
    );
    expect(Object.keys(result.marks).sort()).toEqual(["cost", "failover", "mechanism"]);
    expect(result.marks.failover).toBe("missed");
    expect(result.marks.cost).toBe("missed");
    expect(result.notes.cost).toBe("Not addressed in the assessment.");
  });

  it("ignores ids that are not in the rubric and keeps the first mark for a repeated id", () => {
    const result = toAiAssessment(
      grade([
        { id: "invented", mark: "covered", passage: 0, note: "" },
        { id: "mechanism", mark: "missed", passage: null, note: "First." },
        { id: "mechanism", mark: "covered", passage: 0, note: "Second." },
      ]),
      rubric,
      passages,
      meta,
    );
    expect(Object.keys(result.marks)).toEqual(["mechanism", "failover", "cost"]);
    expect(result.marks.mechanism).toBe("missed");
    expect(result.notes.mechanism).toBe("First.");
  });

  it("records which run, model and time produced the assessment", () => {
    const result = toAiAssessment(grade([]), rubric, passages, meta);
    expect(result).toMatchObject({ runId: "run-1", model: "fast-model", assessedAt: meta.now });
  });
});
