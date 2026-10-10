import "server-only";
import type { ProjectModel } from "@/lib/domain/project-model";
import { QUESTION_GROUP_LABELS, QUESTION_GROUPS } from "@/lib/domain/project-questions";
import { DIMENSIONS } from "@/lib/domain/taxonomy";
import { INJECTION_GUARD, type UntrustedDocument, wrapUntrusted } from "../untrusted";

export type QuestionsPromptInput = {
  name: string;
  summary: string;
  context?: string;
  model: ProjectModel;
  reviewFindingTitles?: string[];
  templateTitles: string[];
  /** One line per concept: `id: title. summary`. */
  catalog: string;
};

const GROUPS = QUESTION_GROUPS.map((group) => `- ${group}: ${QUESTION_GROUP_LABELS[group].description}`).join("\n");

const INSTRUCTIONS = `${INJECTION_GUARD}

You write interview questions about one software system, the one in the project document. Ask what an experienced interviewer would ask about this system and no other: the trade-offs its review findings imply, its real technology choices, and its trickiest flow. Do not repeat or reword the existing questions listed in the documents.

Write 8 to 12 questions. For each question:
- id: a short kebab-case slug, unique in the set.
- group: one of the groups below.
- title: a short label, at most 120 characters.
- prompt: the question as the interviewer asks it, addressed to the candidate about this system, at most 800 characters.
- rubric: 2 to 5 points describing what a strong answer must say. Each point has an id (kebab-case), text (at most 240 characters) and weight "core" or "supporting". Include at least one "core" point. Points name mechanisms, constraints, counterexamples or consequences, never bare keywords. A point is "core" only if a candidate cannot pass it by naming a technology.
- reference: the model answer, at most 1,500 characters, in the house style below.
- dimensions: one to three of: ${DIMENSIONS.join(", ")}.
- conceptIds: up to four ids from the concept catalog, and only ids listed there.
- componentIds: up to four component ids from the project document.

House style for the reference: plain prose in 3 to 6 sentences, with no lists or headings. Open with what weak answers usually say (quoted) or the point the question turns on. Then say what a strong answer names: the mechanism, the constraint, the race or the failure, and the specific operation that would be lost or duplicated. End with [[concept-id]] links for the concepts it relies on, using catalog ids only. For example:
"It's in the database" is where a good answer starts, not where it ends. Which write is the commit point? What was acknowledged before that point? A strong answer names the specific operation that would be lost or duplicated on a restart. See [[durability]].

Do not use HTML, URLs or markdown links anywhere.

Question groups:
${GROUPS}`;

export function buildQuestionsPrompt(input: QuestionsPromptInput): { instructions: string; prompt: string } {
  const documents: UntrustedDocument[] = [
    {
      source: "project.json",
      text: JSON.stringify({ name: input.name, summary: input.summary, context: input.context, model: input.model }),
    },
    { source: "existing-questions.txt", text: input.templateTitles.join("\n") },
  ];
  if (input.reviewFindingTitles?.length) {
    documents.push({ source: "review-findings.txt", text: input.reviewFindingTitles.join("\n") });
  }

  return {
    instructions: INSTRUCTIONS,
    prompt: [
      "Write the tailored questions for this project. The documents are the subject, and the concept catalog is the only list of concept ids you may use.",
      wrapUntrusted(documents),
      `Concept catalog:\n${input.catalog}`,
    ].join("\n\n"),
  };
}
