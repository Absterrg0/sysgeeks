/**
 * Output schemas for the AI calls: what each model must return. The
 * normalizers in `lib/domain/` clean up whatever passes these schemas.
 *
 * Server and tests only. Client components import the inferred types with
 * `import type`, so zod stays out of the browser bundle.
 */
import { z } from "zod";
import { RUBRIC_MARKS } from "../domain/learner";
import { QUESTION_GROUPS } from "../domain/project-questions";
import { COMPONENT_KINDS, DIMENSIONS, FLOW_KINDS, SLUG_RE } from "../domain/taxonomy";

const confidence = z.enum(["stated", "inferred", "guessed"]);
const kebab = z.string().regex(SLUG_RE).max(40);
const codeRef = z.object({
  path: z.string().max(300),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
});

export const IntakeDraftSchema = z.object({
  name: z.string().min(1).max(120),
  summary: z.string().min(1).max(600),
  components: z
    .array(
      z.object({
        id: kebab,
        label: z.string().min(1).max(60),
        kind: z.enum(COMPONENT_KINDS),
        responsibility: z.string().min(1).max(240),
        durableState: z.string().max(240).optional(),
        confidence,
        why: z.string().max(240),
        evidence: z.array(codeRef).max(4).optional(),
      }),
    )
    .min(1)
    .max(16),
  flows: z
    .array(
      z.object({
        id: kebab,
        from: kebab,
        to: kebab,
        label: z.string().min(1).max(80),
        kind: z.enum(FLOW_KINDS),
        confidence,
        why: z.string().max(240),
      }),
    )
    .max(30),
  invariants: z
    .array(
      z.object({
        id: kebab,
        statement: z.string().min(1).max(200),
        enforcedBy: z.array(kebab).min(1).max(4),
        mechanism: z.string().max(300),
        confidence,
        why: z.string().max(240),
        evidence: z.array(codeRef).max(4).optional(),
      }),
    )
    .max(8),
  openQuestions: z.array(z.string().max(240)).max(8),
});
export type IntakeDraft = z.infer<typeof IntakeDraftSchema>;

export const ReviewSchema = z.object({
  summary: z.string().min(1).max(900),
  strengths: z
    .array(
      z.object({
        title: z.string().max(100),
        detail: z.string().max(400),
        componentIds: z.array(kebab).max(6),
      }),
    )
    .max(4),
  findings: z
    .array(
      z.object({
        id: kebab,
        category: z.enum([
          "bottleneck",
          "failure-mode",
          "missing-invariant",
          "consistency",
          "scaling-cliff",
          "security",
          "operability",
        ]),
        severity: z.enum(["high", "medium", "low"]),
        confidence: z.enum(["high", "medium", "low"]),
        title: z.string().max(120),
        scenario: z.string().max(600),
        impact: z.string().max(400),
        recommendation: z.string().max(600),
        tradeoff: z.string().max(300),
        componentIds: z.array(kebab).min(1).max(6),
        flowIds: z.array(kebab).max(6),
        conceptIds: z.array(kebab).max(4),
        assumes: z.string().max(240).optional(),
      }),
    )
    .min(1)
    .max(12),
  suggestedInvariants: z
    .array(
      z.object({
        statement: z.string().max(200),
        enforcedBy: z.array(kebab).min(1).max(4),
        mechanism: z.string().max(300),
      }),
    )
    .max(5),
  questionsToAsk: z.array(z.string().max(240)).max(6),
});
export type Review = z.infer<typeof ReviewSchema>;

export const TailoredQuestionSchema = z.object({
  id: kebab,
  group: z.enum(QUESTION_GROUPS),
  title: z.string().max(120),
  prompt: z.string().max(800),
  rubric: z
    .array(
      z.object({
        id: kebab,
        text: z.string().max(240),
        weight: z.enum(["core", "supporting"]),
      }),
    )
    .min(2)
    .max(5),
  reference: z.string().max(1500),
  dimensions: z.array(z.enum(DIMENSIONS)).min(1).max(3),
  conceptIds: z.array(kebab).max(4),
  componentIds: z.array(kebab).max(4),
});

export const TailoredQuestionSetSchema = z.object({
  questions: z.array(TailoredQuestionSchema).min(4).max(12),
});
export type TailoredQuestionSet = z.infer<typeof TailoredQuestionSetSchema>;

export const GradeSchema = z.object({
  points: z.array(
    z.object({
      id: kebab,
      mark: z.enum(RUBRIC_MARKS),
      passage: z.number().int().min(0).nullable(),
      note: z.string().max(240),
    }),
  ),
  summary: z.string().max(400),
});
export type Grade = z.infer<typeof GradeSchema>;
