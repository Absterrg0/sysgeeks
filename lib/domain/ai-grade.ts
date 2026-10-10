/**
 * Turns an AI grade of a written answer into an assessment the app can keep.
 * Pure and client-safe, so the schema type is a type-only import.
 */
import type { Grade } from "../ai/schemas";
import type { RubricPoint } from "./content";
import type { AiAssessment, Citations, SelfAssessment } from "./learner";

const NO_PASSAGE = "No supporting passage";
const NOT_ADDRESSED = "Not addressed in the assessment.";

/**
 * Every rubric point gets exactly one mark. Points the grade leaves out are
 * missed. Covered or partial points must cite a real passage (an index into
 * `passages`, from `splitPassages`); without one they are downgraded to missed.
 */
export function toAiAssessment(
  grade: Grade,
  rubric: readonly RubricPoint[],
  passages: readonly string[],
  meta: { runId: string; model: string; now: string },
): AiAssessment {
  const graded = new Map<string, Grade["points"][number]>();
  for (const point of grade.points) {
    if (!graded.has(point.id)) graded.set(point.id, point);
  }

  const marks: SelfAssessment = {};
  const citations: Citations = {};
  const notes: Record<string, string> = {};
  for (const { id } of rubric) {
    const point = graded.get(id);
    if (!point) {
      marks[id] = "missed";
      notes[id] = NOT_ADDRESSED;
      continue;
    }
    const passage = point.passage === null ? undefined : passages[point.passage];
    if (point.mark === "missed") {
      marks[id] = "missed";
      notes[id] = point.note;
    } else if (passage === undefined) {
      marks[id] = "missed";
      notes[id] = NO_PASSAGE;
    } else {
      marks[id] = point.mark;
      citations[id] = passage;
      notes[id] = point.note;
    }
  }

  return {
    runId: meta.runId,
    model: meta.model,
    assessedAt: meta.now,
    marks,
    citations,
    notes,
    summary: grade.summary,
  };
}
