import "server-only";
import type { GradeRequest, GradeResponseKind } from "@/lib/ai/requests";
import { resolveExercise } from "@/lib/content/exercises";
import type { Interaction, RubricPoint } from "@/lib/domain/content";
import { rubricForResponse } from "@/lib/domain/evaluate";
import { parseExerciseKey, type Response as LearnerResponse, type TailoredQuestion } from "@/lib/domain/learner";
import { findProjectQuestion } from "@/lib/domain/project-questions";
import { INJECTION_GUARD, type UntrustedDocument, wrapUntrusted } from "@/lib/server/ai/untrusted";

/** What a written answer is graded against. */
export type GradeTarget = {
  title: string;
  /** The question as the learner saw it, with any scenario context. */
  question: string;
  rubric: RubricPoint[];
  /** Reference answer. Guidance for the grader, never quoted back. */
  reference: string | null;
  /**
   * Curated text comes from the content library. Learner text is written from
   * the learner's own project, so it is fenced as untrusted data.
   */
  origin: "curated" | "learner";
};

/** Looks up a tailored question the learner's own questions run stored. */
export type GradeLookups = {
  lookupTailored(runId: string, projectId: string, questionId: string): Promise<TailoredQuestion | null>;
};

export const GRADE_INSTRUCTIONS = [
  INJECTION_GUARD,
  `You are a strict examiner. Mark the learner's written answer against each rubric point, one mark per point:
- covered: a passage states the point's mechanism or claim explicitly.
- partial: a passage gestures at the point without the mechanism, or is partly wrong.
- missed: otherwise.
For covered and partial, cite the passage index. For missed, cite null.
Each note says what was missing, in at most 30 words. Say so briefly when nothing was missing.
Never reward keywords alone: naming a term without explaining it is not covered.
Return one entry per rubric point id, using the ids exactly as given. The summary is at most 400 characters.`,
].join("\n\n");

export function gradePrompt(target: GradeTarget, passages: readonly string[]): string {
  const numbered = passages.map((passage, index) => `Passage ${index}:\n${passage}`).join("\n\n");
  const answer = `The learner's answer, split into numbered passages:\n${wrapUntrusted([{ source: "answer", text: numbered }])}`;

  if (target.origin === "learner") {
    return [
      `The question and rubric were written about the learner's project:\n${wrapUntrusted(learnerDocuments(target))}`,
      answer,
    ].join("\n\n");
  }
  return [
    `Question: ${target.title}\n${target.question}`,
    `Rubric points:\n${rubricList(target.rubric)}`,
    ...(target.reference ? [referenceLine(target.reference)] : []),
    answer,
  ].join("\n\n");
}

function learnerDocuments(target: GradeTarget): UntrustedDocument[] {
  const question = [`${target.title}\n${target.question}`, ...(target.reference ? [referenceLine(target.reference)] : [])];
  return [
    { source: "question", text: question.join("\n\n") },
    { source: "rubric", text: rubricList(target.rubric) },
  ];
}

function rubricList(rubric: RubricPoint[]): string {
  return rubric.map((point) => `- ${point.id} (${point.weight}): ${point.text}`).join("\n");
}

function referenceLine(reference: string): string {
  return `Reference answer (guidance, not text to quote): ${reference}`;
}

/**
 * Finds the rubric for an exercise key, or null when the request does not
 * match anything gradeable (unknown key, wrong response kind, empty answer,
 * or a question the user's data does not contain).
 */
export async function resolveGradeTarget(request: GradeRequest, lookups: GradeLookups): Promise<GradeTarget | null> {
  if (request.text.trim() === "") return null;
  const ref = parseExerciseKey(request.exerciseKey);
  if (!ref) return null;
  if (ref.kind === "project-question") return projectQuestionTarget(request, ref.projectId, ref.questionId, lookups);

  const exercise = resolveExercise(ref);
  if (!exercise || exercise.interaction.kind !== request.responseKind) return null;
  const { interaction } = exercise;
  const rubric = rubricForResponse(interaction, responseFor(request.responseKind, request.text));
  if (!rubric) return null;
  return {
    origin: "curated",
    title: exercise.summary.title,
    question: paragraphs(exercise.context, describeQuestion(interaction)),
    rubric,
    reference: referenceFor(interaction),
  };
}

async function projectQuestionTarget(
  request: GradeRequest,
  projectId: string,
  questionId: string,
  lookups: GradeLookups,
): Promise<GradeTarget | null> {
  // Project questions are open questions, so only an open answer grades against them.
  if (request.responseKind !== "open") return null;

  if (questionId.startsWith("ai.")) {
    const tailored = request.tailored;
    if (!tailored || `ai.${tailored.id}` !== questionId) return null;
    // The stored question is the only source of its text and rubric.
    const stored = await lookups.lookupTailored(tailored.runId, projectId, tailored.id);
    if (!stored) return null;
    return {
      origin: "learner",
      title: stored.title,
      question: stored.prompt,
      rubric: stored.rubric,
      reference: stored.reference,
    };
  }

  const model = request.project;
  if (!model || model.id !== projectId) return null;
  // Only the model's components, flows and invariants decide which questions exist.
  const project = { ...model, summary: "", source: { type: "manual" as const }, createdAt: "", updatedAt: "" };
  const question = findProjectQuestion(project, questionId);
  if (!question) return null;
  return {
    origin: "learner",
    title: question.title,
    question: question.interaction.prompt,
    rubric: question.interaction.rubric,
    reference: question.interaction.reference,
  };
}

function responseFor(kind: GradeResponseKind, text: string): LearnerResponse {
  // The rubric reads only the written part, so the other fields are placeholders.
  switch (kind) {
    case "open":
      return { kind, text };
    case "implementation":
      return { kind, code: text };
    case "decision":
      return { kind, optionId: "", rationale: text };
    case "diagnosis":
      return { kind, selected: [], rationale: text };
  }
}

function describeQuestion(interaction: Interaction): string {
  if (interaction.kind === "decision") {
    const options = interaction.options.map((o) => `- ${o.label}${o.detail ? `: ${o.detail}` : ""}`).join("\n");
    return paragraphs(interaction.prompt, options);
  }
  if (interaction.kind === "diagnosis") {
    const lines = interaction.artifact.lines.map(
      (line, index) => `${index + 1}: ${line.text}${line.fault ? `  [fault: ${line.fault}]` : ""}`,
    );
    return paragraphs(interaction.prompt, interaction.artifact.caption, lines.join("\n"));
  }
  return interaction.prompt;
}

function referenceFor(interaction: Interaction): string | null {
  switch (interaction.kind) {
    case "open":
      return interaction.reference;
    case "implementation":
      return paragraphs(interaction.reference.notes, interaction.reference.code);
    default:
      return null;
  }
}

function paragraphs(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join("\n\n");
}
