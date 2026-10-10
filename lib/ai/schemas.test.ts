import { describe, expect, it } from "vitest";
import { GradeSchema, IntakeDraftSchema, ReviewSchema, TailoredQuestionSetSchema } from "./schemas";

const component = {
  id: "api",
  label: "API",
  kind: "service",
  responsibility: "Serves requests.",
  confidence: "stated",
  why: "Named in the description.",
};

const draft = {
  name: "Shop",
  summary: "A shop.",
  components: [component],
  flows: [],
  invariants: [],
  openQuestions: [],
};

const finding = {
  id: "lost-writes",
  category: "failure-mode",
  severity: "high",
  confidence: "medium",
  title: "Lost writes",
  scenario: "When the database restarts mid-write.",
  impact: "Orders vanish.",
  recommendation: "Use a transaction.",
  tradeoff: "Latency.",
  componentIds: ["api"],
  flowIds: [],
  conceptIds: [],
};

const review = {
  summary: "A small shop.",
  strengths: [],
  findings: [finding],
  suggestedInvariants: [],
  questionsToAsk: [],
};

const rubric = [
  { id: "timeout", text: "Names the timeout.", weight: "core" },
  { id: "retries", text: "Says whether retries are safe.", weight: "supporting" },
];

const tailored = {
  id: "stall",
  group: "failure",
  title: "What if the database stalls?",
  prompt: "Explain what the API does.",
  rubric,
  reference: "It times out.",
  dimensions: ["break"],
  conceptIds: [],
  componentIds: ["api"],
};

describe("IntakeDraftSchema", () => {
  it("accepts a draft the model could return", () => {
    expect(IntakeDraftSchema.safeParse(draft).success).toBe(true);
  });

  it("requires kebab-case ids", () => {
    const result = IntakeDraftSchema.safeParse({ ...draft, components: [{ ...component, id: "API Gateway" }] });
    expect(result.success).toBe(false);
  });

  it("requires at least one component and at most sixteen", () => {
    expect(IntakeDraftSchema.safeParse({ ...draft, components: [] }).success).toBe(false);
    const many = Array.from({ length: 17 }, (_, i) => ({ ...component, id: `c-${i}` }));
    expect(IntakeDraftSchema.safeParse({ ...draft, components: many }).success).toBe(false);
  });

  it("rejects an unknown confidence", () => {
    expect(IntakeDraftSchema.safeParse({ ...draft, components: [{ ...component, confidence: "sure" }] }).success).toBe(
      false,
    );
  });
});

describe("ReviewSchema", () => {
  it("accepts a review", () => {
    expect(ReviewSchema.safeParse(review).success).toBe(true);
  });

  it("requires at least one finding", () => {
    expect(ReviewSchema.safeParse({ ...review, findings: [] }).success).toBe(false);
  });

  it("requires every finding to name a component", () => {
    expect(ReviewSchema.safeParse({ ...review, findings: [{ ...finding, componentIds: [] }] }).success).toBe(false);
  });
});

describe("TailoredQuestionSetSchema", () => {
  const question = (id: string) => ({ ...tailored, id });

  it("accepts four to twelve questions", () => {
    const four = ["a", "b", "c", "d"].map(question);
    expect(TailoredQuestionSetSchema.safeParse({ questions: four }).success).toBe(true);
    expect(TailoredQuestionSetSchema.safeParse({ questions: four.slice(0, 3) }).success).toBe(false);
  });

  it("requires two to five rubric points", () => {
    const one = { ...tailored, rubric: rubric.slice(0, 1) };
    const sets = ["a", "b", "c"].map(question).concat(one);
    expect(TailoredQuestionSetSchema.safeParse({ questions: sets }).success).toBe(false);
  });
});

describe("GradeSchema", () => {
  it("accepts marks with and without a passage", () => {
    const result = GradeSchema.safeParse({
      points: [
        { id: "timeout", mark: "covered", passage: 0, note: "" },
        { id: "retries", mark: "missed", passage: null, note: "Never mentioned." },
      ],
      summary: "Partly there.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown mark and a negative passage", () => {
    expect(
      GradeSchema.safeParse({ points: [{ id: "a", mark: "partly", passage: 0, note: "" }], summary: "" }).success,
    ).toBe(false);
    expect(
      GradeSchema.safeParse({ points: [{ id: "a", mark: "covered", passage: -1, note: "" }], summary: "" }).success,
    ).toBe(false);
  });
});
