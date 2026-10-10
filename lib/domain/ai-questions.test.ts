import { describe, expect, it } from "vitest";
import type { TailoredQuestionSet } from "../ai/schemas";
import { normalizeQuestions } from "./ai-questions";
import type { ProjectModel } from "./project-model";

const model: ProjectModel = {
  components: [
    { id: "api", label: "API", kind: "service", responsibility: "Serves requests." },
    { id: "db", label: "Database", kind: "database", responsibility: "Stores rows." },
  ],
  flows: [],
  invariants: [],
};

const known = new Set(["idempotency", "timeouts"]);
const now = "2026-01-01T00:00:00.000Z";

type Question = TailoredQuestionSet["questions"][number];

function question(id: string, extra: Partial<Question> = {}): Question {
  return {
    id,
    group: "failure",
    title: "What if the database stalls?",
    prompt: "Explain what the API does while a write waits.",
    rubric: [
      { id: "timeout", text: "Names the timeout and what happens when it fires.", weight: "core" },
      { id: "retries", text: "Says whether retries are safe.", weight: "supporting" },
    ],
    reference: "The API times out and returns an error; a retry is safe only with an idempotency key.",
    dimensions: ["break"],
    conceptIds: ["timeouts"],
    componentIds: ["db"],
    ...extra,
  };
}

function normalize(questions: Question[]) {
  return normalizeQuestions({ questions }, model, known, now, "run-1");
}

describe("normalizeQuestions", () => {
  it("stamps each question with the run and time, and keeps a valid question as it is", () => {
    const [result] = normalize([question("stall")]);
    expect(result).toEqual({ ...question("stall"), generatedAt: now, runId: "run-1" });
  });

  it("promotes the first rubric point to core when none is core", () => {
    const [result] = normalize([
      question("stall", {
        rubric: [
          { id: "timeout", text: "Names the timeout.", weight: "supporting" },
          { id: "retries", text: "Says whether retries are safe.", weight: "supporting" },
        ],
      }),
    ]);
    expect(result?.rubric.map((p) => p.weight)).toEqual(["core", "supporting"]);
  });

  it("keeps question and rubric ids unique", () => {
    const [first, second] = normalize([
      question("stall", { rubric: [{ id: "a", text: "One.", weight: "core" }, { id: "a", text: "Two.", weight: "supporting" }] }),
      question("stall"),
    ]);
    expect(first?.rubric.map((p) => p.id)).toEqual(["a", "a-2"]);
    expect(second?.id).toBe("stall-2");
  });

  it("keeps only catalog concepts and the model's components", () => {
    const [result] = normalize([question("stall", { conceptIds: ["timeouts", "quorum"], componentIds: ["db", "cache"] })]);
    expect(result).toMatchObject({ conceptIds: ["timeouts"], componentIds: ["db"] });
  });

  it("unwraps unknown concept links in the prose", () => {
    const [result] = normalize([
      question("stall", {
        prompt: "How does [[quorum|quorum reads]] interact with [[idempotency]]?",
        reference: "See [[raft]].",
      }),
    ]);
    expect(result?.prompt).toBe("How does quorum reads interact with [[idempotency]]?");
    expect(result?.reference).toBe("See raft.");
  });
});
