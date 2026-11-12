/**
 * The AI features, run in the learner's browser with their own key. These replace what used to be the
 * /api/ai/* routes: same prompts, same schemas, same checks on the output, but the request goes from the
 * browser to the provider and the result is kept in the learner's own store.
 */
import { catalogText, type ConceptSummary, loadConceptCatalog } from "@/lib/ai/catalog";
import { AiFailure } from "@/lib/ai/errors";
import type { AiEvent } from "@/lib/ai/events";
import { generateStructured } from "@/lib/ai/generate";
import { fetchRepoSnapshot, parseRepoUrl } from "@/lib/ai/github";
import { GRADE_INSTRUCTIONS, type GradeSubject, gradePrompt, gradeTarget } from "@/lib/ai/prompts/grade";
import { intakeInstructions, intakePrompt } from "@/lib/ai/prompts/intake";
import { buildQuestionsPrompt } from "@/lib/ai/prompts/questions";
import { reviewPrompt } from "@/lib/ai/prompts/review";
import { modelLabel, PROVIDERS } from "@/lib/ai/providers";
import {
  type GradeResponseKind,
  IntakeRequestSchema,
  QuestionsRequestSchema,
  type QuestionsRequest,
  ReviewRequestSchema,
} from "@/lib/ai/requests";
import { GradeSchema, IntakeDraftSchema, type Review, ReviewSchema, TailoredQuestionSetSchema } from "@/lib/ai/schemas";
import { toAiAssessment } from "@/lib/domain/ai-grade";
import { normalizeQuestions } from "@/lib/domain/ai-questions";
import { normalizeReview } from "@/lib/domain/ai-review";
import { normalizeDraft } from "@/lib/domain/draft";
import type { AiAssessment, AiRun, AiRunFeature, Project } from "@/lib/domain/learner";
import { modelHash } from "@/lib/domain/model-hash";
import { lintModel } from "@/lib/domain/model-lint";
import { splitPassages } from "@/lib/domain/passages";
import { projectQuestions } from "@/lib/domain/project-questions";
import { type AiKeySettings, readAiKey } from "@/lib/store/ai-key-store";
import { recordAiRun } from "@/lib/store/learner-store";

const REPO_FETCH_TIMEOUT_MS = 60_000;

type Emit = (event: AiEvent) => void;
type Context = { settings: AiKeySettings; emit: Emit; signal?: AbortSignal; runId: string };

/** The key to run with, or a key_missing failure the caller shows as "Add your API key". */
function requireKey(): AiKeySettings {
  const settings = readAiKey();
  if (!settings) throw new AiFailure("key_missing");
  return settings;
}

function invalidInput(issues: readonly { code: string }[]): AiFailure {
  return new AiFailure(issues.some((issue) => issue.code === "too_big") ? "input_too_large" : "input_invalid");
}

async function catalog(): Promise<ConceptSummary[]> {
  try {
    return await loadConceptCatalog();
  } catch {
    throw new AiFailure("ai_unavailable");
  }
}

function where(settings: AiKeySettings): string {
  return `${PROVIDERS[settings.provider].label} · ${modelLabel(settings.provider, settings.model)}`;
}

function record(ctx: Context, run: Omit<AiRun, "id" | "createdAt" | "provider">) {
  recordAiRun({ id: ctx.runId, createdAt: new Date().toISOString(), provider: ctx.settings.provider, ...run });
}

// ---------------------------------------------------------------------------
// Architecture review
// ---------------------------------------------------------------------------

export type ReviewOutput = { review: Review; modelHash: string; model: string };

async function review(body: unknown, ctx: Context): Promise<ReviewOutput> {
  const parsed = ReviewRequestSchema.safeParse(body);
  if (!parsed.success) throw invalidInput(parsed.error.issues);
  const request = parsed.data;
  const concepts = await catalog();
  const hash = modelHash(request.model);
  const { instructions, prompt } = reviewPrompt({
    name: request.name,
    summary: request.summary,
    context: request.context,
    model: request.model,
    lint: lintModel(request.model),
    catalog: catalogText(concepts),
  });

  ctx.emit({ type: "progress", step: "Reviewing the design", detail: `Reviewing the design with ${where(ctx.settings)}`, runId: ctx.runId });
  const served = await generateStructured({
    settings: ctx.settings,
    instructions,
    prompt,
    schema: ReviewSchema,
    maxOutputTokens: 10_000,
    signal: ctx.signal,
  });
  const normalized = normalizeReview(served.output, request.model, new Set(concepts.map((c) => c.id)));
  // A report with no findings can't be rendered, so it counts as a failed run.
  if (normalized.findings.length === 0) throw new AiFailure("invalid_output");

  const output: ReviewOutput = { review: normalized, modelHash: hash, model: served.model };
  record(ctx, { feature: "review", model: served.model, title: request.name, projectId: request.projectId, modelHash: hash, output });
  return output;
}

// ---------------------------------------------------------------------------
// Tailored questions
// ---------------------------------------------------------------------------

function projectFromInput(input: QuestionsRequest, now: string): Project {
  return {
    id: input.projectId,
    name: input.name,
    summary: input.summary,
    context: input.context,
    source: { type: "manual" },
    components: input.model.components,
    flows: input.model.flows,
    invariants: input.model.invariants,
    createdAt: now,
    updatedAt: now,
  };
}

async function questions(body: unknown, ctx: Context) {
  const parsed = QuestionsRequestSchema.safeParse(body);
  if (!parsed.success) throw invalidInput(parsed.error.issues);
  const input = parsed.data;
  const concepts = await catalog();
  const project = projectFromInput(input, new Date().toISOString());
  const { instructions, prompt } = buildQuestionsPrompt({
    name: input.name,
    summary: input.summary,
    context: input.context,
    model: input.model,
    reviewFindingTitles: input.reviewFindingTitles,
    templateTitles: projectQuestions(project).map((question) => question.title),
    catalog: catalogText(concepts),
  });

  ctx.emit({ type: "progress", step: "Writing questions", detail: `Writing questions with ${where(ctx.settings)}`, runId: ctx.runId });
  const generated = await generateStructured({
    settings: ctx.settings,
    instructions,
    prompt,
    schema: TailoredQuestionSetSchema,
    maxOutputTokens: 8000,
    signal: ctx.signal,
  });
  const written = normalizeQuestions(
    generated.output,
    input.model,
    new Set(concepts.map((c) => c.id)),
    new Date().toISOString(),
    ctx.runId,
  );
  const output = { questions: written };
  record(ctx, {
    feature: "questions",
    model: generated.model,
    title: input.name,
    projectId: input.projectId,
    modelHash: modelHash(input.model),
    output,
  });
  return output;
}

// ---------------------------------------------------------------------------
// Drafting a project from text or a public repository
// ---------------------------------------------------------------------------

async function intake(body: unknown, ctx: Context) {
  const parsed = IntakeRequestSchema.safeParse(body);
  if (!parsed.success) throw invalidInput(parsed.error.issues);
  const request = parsed.data;
  const ref = request.method === "repository" ? parseRepoUrl(request.repoUrl ?? "") : null;
  if (request.method === "repository" && !ref) throw new AiFailure("input_invalid");

  // GitHub is read from this browser too, so a repository draft never passes through our servers.
  if (ref) ctx.emit({ type: "progress", step: "Reading repository", detail: `Reading ${ref.owner}/${ref.repo} from GitHub` });
  const snapshot = ref
    ? await fetchRepoSnapshot(ref, {
        signal: AbortSignal.any([AbortSignal.timeout(REPO_FETCH_TIMEOUT_MS), ...(ctx.signal ? [ctx.signal] : [])]),
        onProgress: (_step, _detail, files) => {
          if (files) ctx.emit({ type: "progress", step: `Selected ${files.length} files`, files });
        },
      })
    : null;

  const documents = snapshot
    ? snapshot.files.map((file) => ({ source: `repo:${file.path}`, text: file.text }))
    : [{ source: request.method === "readme" ? "README" : "description", text: request.text ?? "" }];
  const source = snapshot
    ? { type: "repository" as const, url: snapshot.url, commit: snapshot.commit }
    : { type: "description" as const };
  const allowedPaths = snapshot ? new Set(snapshot.files.map((file) => file.path)) : undefined;

  ctx.emit({ type: "progress", step: "Drafting model", detail: `Drafting the model with ${where(ctx.settings)}`, runId: ctx.runId });
  const drafted = await generateStructured({
    settings: ctx.settings,
    instructions: intakeInstructions(),
    prompt: intakePrompt({ name: request.name, context: request.context, documents, listing: snapshot?.listing }),
    schema: IntakeDraftSchema,
    maxOutputTokens: 12_000,
    timeoutMs: 200_000,
    signal: ctx.signal,
  });

  ctx.emit({ type: "progress", step: "Checking the draft", runId: ctx.runId });
  const { draft, dropped } = normalizeDraft(drafted.output, { allowedPaths });
  if (draft.components.length === 0) throw new AiFailure("invalid_output");

  const output = { draft, dropped, source };
  record(ctx, {
    feature: "intake",
    model: drafted.model,
    title: request.name?.trim() || (ref ? `${ref.owner}/${ref.repo}` : draft.name),
    inputSummary: { method: request.method, url: snapshot?.url },
    output,
  });
  return output;
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

const RUNNERS: Record<AiRunFeature, (body: unknown, ctx: Context) => Promise<unknown>> = { review, questions, intake };

/** The route paths callers used before AI moved into the browser. */
type LegacyPath = `/api/ai/${AiRunFeature}`;

function featureOf(name: AiRunFeature | LegacyPath): AiRunFeature {
  return name.startsWith("/api/ai/") ? (name.slice("/api/ai/".length) as AiRunFeature) : (name as AiRunFeature);
}

/**
 * Runs an AI feature with the learner's key. `onEvent` sees progress as it happens and the result at the end.
 * Resolves with the result data, or rejects with an AiFailure carrying the error code.
 */
export async function runAiNow<T = unknown>(
  feature: AiRunFeature | LegacyPath,
  body: unknown,
  onEvent: (event: AiEvent) => void = () => {},
  signal?: AbortSignal,
): Promise<T> {
  const runId = crypto.randomUUID();
  try {
    const settings = requireKey();
    const data = await RUNNERS[featureOf(feature)](body, { settings, emit: onEvent, signal, runId });
    onEvent({ type: "result", runId, data });
    return data as T;
  } catch (error) {
    const failure = error instanceof AiFailure ? error : new AiFailure("model_failed");
    onEvent({ type: "error", code: failure.code, message: failure.message, detail: failure.detail, runId });
    throw failure;
  }
}

/** Marks a written answer against its rubric. The assessment is kept on the attempt, not as a run. */
export async function gradeAnswerNow(
  subject: GradeSubject,
  responseKind: GradeResponseKind,
  text: string,
  signal?: AbortSignal,
): Promise<AiAssessment> {
  const settings = requireKey();
  const target = gradeTarget(subject, responseKind, text);
  if (!target) throw new AiFailure("input_invalid");
  const passages = splitPassages(text, responseKind === "implementation" ? "code" : "prose");
  const grade = await generateStructured({
    settings,
    instructions: GRADE_INSTRUCTIONS,
    prompt: gradePrompt(target, passages),
    schema: GradeSchema,
    maxOutputTokens: 2000,
    timeoutMs: 60_000,
    signal,
  });
  return toAiAssessment(grade.output, target.rubric, passages, {
    runId: crypto.randomUUID(),
    model: grade.model,
    now: new Date().toISOString(),
  });
}
