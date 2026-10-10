import { describe, expect, it } from "vitest";
import type { Review } from "../ai/schemas";
import { normalizeReview } from "./ai-review";
import type { ProjectModel } from "./project-model";

const model: ProjectModel = {
  components: [
    { id: "api", label: "API", kind: "service", responsibility: "Serves requests." },
    { id: "db", label: "Database", kind: "database", responsibility: "Stores rows." },
  ],
  flows: [{ id: "write", from: "api", to: "db", label: "Write", kind: "request" }],
  invariants: [],
};

const known = new Set(["idempotency", "durability"]);

function finding(extra: Partial<Review["findings"][number]> = {}): Review["findings"][number] {
  return {
    id: "lost-writes",
    category: "failure-mode",
    severity: "high",
    confidence: "medium",
    title: "Lost writes",
    scenario: "When the database restarts mid-write.",
    impact: "Orders vanish.",
    recommendation: "Use [[durability]].",
    tradeoff: "Latency.",
    componentIds: ["db"],
    flowIds: ["write"],
    conceptIds: ["durability"],
    ...extra,
  };
}

function review(parts: Partial<Review> = {}): Review {
  return {
    summary: "A small shop.",
    strengths: [],
    findings: [finding()],
    suggestedInvariants: [],
    questionsToAsk: [],
    ...parts,
  };
}

describe("normalizeReview", () => {
  it("keeps component and flow ids that are in the model, and drops the rest", () => {
    const result = normalizeReview(
      review({ findings: [finding({ componentIds: ["db", "ghost"], flowIds: ["write", "nope"] })] }),
      model,
      known,
    );
    expect(result.findings[0]).toMatchObject({ componentIds: ["db"], flowIds: ["write"] });
  });

  it("drops findings left with no component", () => {
    const result = normalizeReview(
      review({ findings: [finding({ componentIds: ["ghost"] }), finding({ id: "stale-reads", componentIds: ["api"] })] }),
      model,
      known,
    );
    expect(result.findings.map((f) => f.id)).toEqual(["stale-reads"]);
  });

  it("keeps only concepts from the catalog", () => {
    const result = normalizeReview(review({ findings: [finding({ conceptIds: ["durability", "quorum"] })] }), model, known);
    expect(result.findings[0]?.conceptIds).toEqual(["durability"]);
  });

  it("unwraps unknown concept links in all prose and keeps known ones", () => {
    const result = normalizeReview(
      review({
        summary: "See [[quorum|quorum reads]] and [[idempotency]].",
        findings: [finding({ recommendation: "Use [[durability]] and [[raft]]." })],
        questionsToAsk: ["What is [[consensus]]?"],
      }),
      model,
      known,
    );
    expect(result.summary).toBe("See quorum reads and [[idempotency]].");
    expect(result.findings[0]?.recommendation).toBe("Use [[durability]] and raft.");
    expect(result.questionsToAsk).toEqual(["What is consensus?"]);
  });

  it("filters strengths and suggested invariants to the model's components", () => {
    const result = normalizeReview(
      review({
        strengths: [{ title: "Simple", detail: "One store.", componentIds: ["db", "ghost"] }],
        suggestedInvariants: [
          { statement: "Writes are unique.", enforcedBy: ["ghost"], mechanism: "A unique index." },
          { statement: "Rows persist.", enforcedBy: ["db", "ghost"], mechanism: "Synchronous commit." },
        ],
      }),
      model,
      known,
    );
    expect(result.strengths[0]?.componentIds).toEqual(["db"]);
    expect(result.suggestedInvariants).toEqual([
      { statement: "Rows persist.", enforcedBy: ["db"], mechanism: "Synchronous commit." },
    ]);
  });

  it("keeps finding ids unique", () => {
    const result = normalizeReview(review({ findings: [finding(), finding()] }), model, known);
    expect(result.findings.map((f) => f.id)).toEqual(["lost-writes", "lost-writes-2"]);
  });

  it("keeps suffixed finding ids within 40 characters", () => {
    const id = "a".repeat(60);
    const result = normalizeReview(review({ findings: [finding({ id }), finding({ id })] }), model, known);
    expect(result.findings.map((f) => f.id)).toEqual(["a".repeat(40), `${"a".repeat(38)}-2`]);
  });
});
