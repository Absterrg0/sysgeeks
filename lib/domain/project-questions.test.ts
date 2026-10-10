import { describe, expect, it } from "vitest";
import { getConcept } from "@/lib/content";
import { type ExerciseRef, MAX_TAILORED_QUESTIONS, type Project, type TailoredQuestion } from "./learner";
import { PROJECT_QUESTION_ID_RE } from "./learner";
import { findProjectQuestion, projectQuestions, regenerateTailored, templateConceptIds } from "./project-questions";

const project: Project = {
  id: "shop",
  name: "Shop",
  summary: "",
  source: { type: "manual" },
  components: [
    { id: "web", label: "Web app", kind: "client", responsibility: "UI" },
    { id: "api", label: "API", kind: "service", responsibility: "Orders" },
    { id: "db", label: "Postgres", kind: "database", responsibility: "Orders", durableState: "orders" },
    { id: "stripe", label: "Stripe", kind: "external", responsibility: "Payments" },
    { id: "mailer", label: "Mailer", kind: "worker", responsibility: "Emails" },
  ],
  flows: [
    { id: "checkout", from: "web", to: "api", label: "Checkout", kind: "request" },
    { id: "send-email", from: "api", to: "mailer", label: "Send receipt", kind: "async" },
  ],
  invariants: [{ id: "one-order", statement: "One order per cart", enforcedBy: ["db"], mechanism: "unique" }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("project questions", () => {
  it("derives questions from the model", () => {
    const ids = projectQuestions(project).map((q) => q.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "trace.checkout",
        "durable.db",
        "dependency.db",
        "dependency.stripe",
        "redelivery.send-email",
        "invariant.one-order",
        "boundary.mailer",
        "retry",
        "scale",
      ]),
    );
    expect(ids).not.toContain("dependency.api");
  });

  it("produces unique, valid ids that round-trip", () => {
    const ids = projectQuestions(project).map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(PROJECT_QUESTION_ID_RE.test(id), id).toBe(true);
      expect(findProjectQuestion(project, id)?.id).toBe(id);
    }
  });

  it("only references concepts that exist", () => {
    for (const id of templateConceptIds()) expect(getConcept(id), id).toBeDefined();
  });

  it("gives every question a core rubric point", () => {
    for (const q of projectQuestions(project)) {
      expect(q.interaction.rubric.some((r) => r.weight === "core"), q.id).toBe(true);
    }
  });

  it("appends tailored questions as AI-written open questions", () => {
    const tailored: TailoredQuestion = {
      id: "x",
      group: "defend",
      title: "Why the queue",
      prompt: "Why is there a queue between the API and the mailer?",
      rubric: [
        { id: "constraint", text: "Names the constraint that forces the boundary.", weight: "core" },
        { id: "cost", text: "Names what the boundary costs.", weight: "supporting" },
      ],
      reference: "The receipt takes seconds to send, and must not delay checkout.",
      dimensions: ["defend"],
      conceptIds: ["asynchronous-processing"],
      componentIds: ["mailer"],
      generatedAt: "2026-01-01T00:00:00.000Z",
      runId: "run1",
    };
    const withAi: Project = { ...project, tailoredQuestions: [tailored] };

    expect(findProjectQuestion(withAi, "ai.x")).toEqual({
      id: "ai.x",
      group: "defend",
      title: "Why the queue",
      aiWritten: true,
      interaction: {
        kind: "open",
        prompt: tailored.prompt,
        placeholder: expect.any(String),
        rubric: tailored.rubric,
        reference: tailored.reference,
      },
      tags: { dimensions: ["defend"], conceptIds: ["asynchronous-processing"], competencyIds: [] },
    });
    expect(PROJECT_QUESTION_ID_RE.test("ai.x")).toBe(true);
    expect(projectQuestions(project).some((q) => q.aiWritten)).toBe(false);
  });

  it("regenerates tailored questions, keeping answered ones and capping the list", () => {
    const make = (id: string): TailoredQuestion => ({
      id,
      group: "defend",
      title: id,
      prompt: "Why?",
      rubric: [
        { id: "core", text: "Core point.", weight: "core" },
        { id: "extra", text: "Supporting point.", weight: "supporting" },
      ],
      reference: "A reference.",
      dimensions: ["defend"],
      conceptIds: [],
      componentIds: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
      runId: "run1",
    });
    const answeredRef = (id: string): { exercise: ExerciseRef } => ({
      exercise: { kind: "project-question", projectId: "shop", questionId: `ai.${id}` },
    });

    const withAi: Project = { ...project, tailoredQuestions: [make("kept"), make("stale")] };
    const regenerated = regenerateTailored(withAi, [answeredRef("kept")], [make("new-a"), make("kept")]);
    const ids = regenerated.map((q) => q.id);
    expect(ids[0]).toBe("kept");
    expect(ids).not.toContain("stale");
    expect(ids).toContain("new-a");
    expect(new Set(ids).size).toBe(ids.length);

    const old = Array.from({ length: 20 }, (_, i) => make(`old-${i}`));
    const fresh = Array.from({ length: 8 }, (_, i) => make(`new-${i}`));
    const capped = regenerateTailored(
      { ...project, tailoredQuestions: old },
      old.map((q) => answeredRef(q.id)),
      fresh,
    ).map((q) => q.id);
    expect(capped).toHaveLength(MAX_TAILORED_QUESTIONS);
    expect(capped.slice(-fresh.length)).toEqual(fresh.map((q) => q.id));
  });
});
