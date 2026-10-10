/**
 * Architecture review post-processing. Pure and client-safe, so the schema
 * type is a type-only import.
 */
import type { Review } from "../ai/schemas";
import { sanitizeConceptLinks } from "./concept-links";
import { uniqueSlug } from "./layout";
import type { ProjectModel } from "./project-model";

/**
 * Keeps only references the model and the concept catalog know about, and
 * makes all prose safe to show. A finding left with no component is dropped.
 */
export function normalizeReview(review: Review, model: ProjectModel, knownConcepts: ReadonlySet<string>): Review {
  const components = new Set(model.components.map((c) => c.id));
  const flows = new Set(model.flows.map((f) => f.id));
  const prose = (text: string) => sanitizeConceptLinks(text, knownConcepts);
  const known = (ids: readonly string[], allowed: ReadonlySet<string>) => [
    ...new Set(ids.filter((id) => allowed.has(id))),
  ];

  const takenFindings = new Set<string>();
  const findings = review.findings.flatMap((finding) => {
    const componentIds = known(finding.componentIds, components);
    if (componentIds.length === 0) return [];
    const id = uniqueSlug(finding.id, takenFindings);
    takenFindings.add(id);
    return [
      {
        ...finding,
        id,
        title: prose(finding.title),
        scenario: prose(finding.scenario),
        impact: prose(finding.impact),
        recommendation: prose(finding.recommendation),
        tradeoff: prose(finding.tradeoff),
        assumes: finding.assumes && prose(finding.assumes),
        componentIds,
        flowIds: known(finding.flowIds, flows),
        conceptIds: known(finding.conceptIds, knownConcepts),
      },
    ];
  });

  return {
    summary: prose(review.summary),
    strengths: review.strengths.map((strength) => ({
      title: prose(strength.title),
      detail: prose(strength.detail),
      componentIds: known(strength.componentIds, components),
    })),
    findings,
    suggestedInvariants: review.suggestedInvariants.flatMap((invariant) => {
      const enforcedBy = known(invariant.enforcedBy, components);
      if (enforcedBy.length === 0) return [];
      return [{ statement: prose(invariant.statement), enforcedBy, mechanism: prose(invariant.mechanism) }];
    }),
    questionsToAsk: review.questionsToAsk.map((question) => prose(question)),
  };
}
