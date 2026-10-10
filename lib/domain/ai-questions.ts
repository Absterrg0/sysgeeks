/**
 * Tailored question post-processing. Pure and client-safe, so the schema type
 * is a type-only import.
 */
import type { TailoredQuestionSet } from "../ai/schemas";
import { sanitizeConceptLinks } from "./concept-links";
import type { TailoredQuestion } from "./learner";
import { uniqueSlug } from "./layout";
import type { ProjectModel } from "./project-model";

/**
 * Makes generated questions safe to store: ids are unique, every question has
 * a core rubric point, concepts and components exist, and prose links resolve.
 */
export function normalizeQuestions(
  set: TailoredQuestionSet,
  model: ProjectModel,
  knownConcepts: ReadonlySet<string>,
  now: string,
  runId: string,
): TailoredQuestion[] {
  const components = new Set(model.components.map((c) => c.id));
  const prose = (text: string) => sanitizeConceptLinks(text, knownConcepts);

  const takenQuestions = new Set<string>();
  return set.questions.map((question) => {
    const id = uniqueSlug(question.id, takenQuestions);
    takenQuestions.add(id);

    const takenPoints = new Set<string>();
    const rubric = question.rubric.map((point) => {
      const pointId = uniqueSlug(point.id, takenPoints);
      takenPoints.add(pointId);
      return { id: pointId, text: prose(point.text), weight: point.weight };
    });
    const first = rubric[0];
    if (first && !rubric.some((point) => point.weight === "core")) first.weight = "core";

    return {
      id,
      group: question.group,
      title: prose(question.title),
      prompt: prose(question.prompt),
      rubric,
      reference: prose(question.reference),
      dimensions: [...new Set(question.dimensions)],
      conceptIds: [...new Set(question.conceptIds.filter((c) => knownConcepts.has(c)))],
      componentIds: [...new Set(question.componentIds.filter((c) => components.has(c)))],
      generatedAt: now,
      runId,
    };
  });
}
