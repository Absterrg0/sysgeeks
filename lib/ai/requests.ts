/**
 * Request bodies for the AI routes, checked on the server before any model
 * call or credit is spent.
 */
import { z } from "zod";
import { slug } from "../domain/content";
import { MAX_PROJECT_CONTEXT } from "../domain/learner";
import { COMPONENT_KINDS, FLOW_KINDS } from "../domain/taxonomy";

/** The most model JSON the review reads, serialized (architecture §2.2). */
const MAX_MODEL_CHARS = 40_000;
const MAX_DESCRIPTION_CHARS = 20_000;
const MAX_README_CHARS = 60_000;

const text = z.string().max(300);
/** Project ids come from `uniqueSlug` (at most 40 characters now, 42 before the cap). */
const projectId = slug.max(64);
const codeLocation = z.object({
  path: text,
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
});

const modelObject = z.object({
  components: z
    .array(
      z.object({
        id: text,
        label: text,
        kind: z.enum(COMPONENT_KINDS),
        responsibility: text,
        durableState: text.optional(),
        evidence: z.array(codeLocation).optional(),
      }),
    )
    .max(30),
  flows: z
    .array(
      z.object({
        id: text,
        from: text,
        to: text,
        label: text,
        kind: z.enum(FLOW_KINDS),
      }),
    )
    .max(60),
  invariants: z
    .array(
      z.object({
        id: text,
        statement: text,
        enforcedBy: z.array(text),
        mechanism: text,
        evidence: z.array(codeLocation).optional(),
      }),
    )
    .max(20),
});

const withinModelSize = (model: unknown) => JSON.stringify(model).length <= MAX_MODEL_CHARS;

export const ProjectModelInputSchema = modelObject.refine(withinModelSize, "The model is too large to review.");
export type ProjectModelInput = z.infer<typeof ProjectModelInputSchema>;

export const IntakeRequestSchema = z
  .object({
    method: z.enum(["description", "readme", "repository"]),
    name: z.string().max(120).optional(),
    text: z.string().max(MAX_README_CHARS).optional(),
    repoUrl: z.string().max(300).optional(),
    context: z.string().max(2000).optional(),
  })
  .superRefine((request, ctx) => {
    if (request.method === "repository") {
      if (!request.repoUrl?.trim()) {
        ctx.addIssue({ code: "custom", path: ["repoUrl"], message: "A repository URL is required." });
      }
      return;
    }
    if (!request.text?.trim()) {
      ctx.addIssue({ code: "custom", path: ["text"], message: "Some text is required." });
    }
    if (request.method === "description" && (request.text?.length ?? 0) > MAX_DESCRIPTION_CHARS) {
      ctx.addIssue({
        code: "custom",
        path: ["text"],
        message: `A description can be at most ${MAX_DESCRIPTION_CHARS} characters.`,
      });
    }
  });
export type IntakeRequest = z.infer<typeof IntakeRequestSchema>;

export const ReviewRequestSchema = z.object({
  projectId,
  name: z.string().min(1).max(120),
  summary: z.string().max(2000),
  context: z.string().max(MAX_PROJECT_CONTEXT).optional(),
  model: ProjectModelInputSchema,
});
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;

export const QuestionsRequestSchema = ReviewRequestSchema.extend({
  reviewFindingTitles: z.array(z.string().max(120)).max(12).optional(),
});
export type QuestionsRequest = z.infer<typeof QuestionsRequestSchema>;

export const GRADE_RESPONSE_KINDS = ["open", "decision", "diagnosis", "implementation"] as const;
export type GradeResponseKind = (typeof GRADE_RESPONSE_KINDS)[number];

export const GradeRequestSchema = z.object({
  exerciseKey: z.string().min(1).max(200),
  responseKind: z.enum(GRADE_RESPONSE_KINDS),
  text: z.string().min(1).max(8000),
  project: modelObject
    .extend({ id: projectId, name: z.string().min(1).max(120) })
    .refine(withinModelSize, "The model is too large to review.")
    .optional(),
  /** Names a stored tailored question. The server reads its text from the run, so any other fields are dropped. */
  tailored: z
    .object({
      id: slug.max(40),
      runId: z.string().min(1).max(100),
    })
    .optional(),
});
export type GradeRequest = z.infer<typeof GradeRequestSchema>;
