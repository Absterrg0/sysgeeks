import { AI_ERROR_MESSAGES, AiFailure, type AiErrorCode } from "@/lib/ai/errors";
import { IntakeDraftSchema } from "@/lib/ai/schemas";
import { IntakeRequestSchema } from "@/lib/ai/requests";
import { features } from "@/lib/config";
import { normalizeDraft } from "@/lib/domain/draft";
import { creditCost } from "@/lib/domain/pricing";
import { DEFAULT_BUDGET } from "@/lib/domain/repo-files";
import { generateStructured } from "@/lib/server/ai/generate";
import { intakeInstructions, intakePrompt } from "@/lib/server/ai/prompts/intake";
import { precheckMetered, runMetered } from "@/lib/server/ai/metered";
import { ndjsonResponse, runFailureEvent } from "@/lib/server/ai/ndjson";
import { requireUser } from "@/lib/server/auth";
import { ensureAccount } from "@/lib/server/billing/ledger";
import { getDb } from "@/lib/server/db";
import { fetchRepoSnapshot, parseRepoUrl } from "@/lib/server/github";

export const maxDuration = 300;

const REPO_FETCH_TIMEOUT_MS = 60_000;
/** Worst-case repository text: the budgeted files, then a listing of up to maxListing paths (assumed under 300 characters each). */
const REPO_TEXT_CHARS = DEFAULT_BUDGET.maxTotalChars + DEFAULT_BUDGET.maxListing * 300;

function errorResponse(code: AiErrorCode, status: number): Response {
  return Response.json({ type: "error", code, message: AI_ERROR_MESSAGES[code], refunded: false }, { status });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const db = features().ai ? getDb() : null;
  if (!db) return errorResponse("ai_unavailable", 503);

  const parsed = IntakeRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const tooLarge = parsed.error.issues.some((issue) => issue.code === "too_big");
    return errorResponse(tooLarge ? "input_too_large" : "input_invalid", tooLarge ? 413 : 400);
  }
  const request = parsed.data;

  const ref = request.method === "repository" ? parseRepoUrl(request.repoUrl ?? "") : null;
  if (request.method === "repository" && !ref) return errorResponse("input_invalid", 400);

  const credits = creditCost("intake", { source: request.method });
  const promptChars =
    intakeInstructions().length + intakePrompt({ name: request.name, context: request.context, documents: [] }).length;
  const inputChars = promptChars + (ref ? REPO_TEXT_CHARS : (request.text ?? "").length);

  return ndjsonResponse(async (emit) => {
    await ensureAccount(db, user.userId, { verifiedEmail: user.verifiedEmail });

    const blocked = await precheckMetered(db, user.userId, "intake", credits);
    if (blocked) {
      emit(runFailureEvent({ code: blocked, runId: null, refunded: false }));
      return;
    }

    const result = await runMetered({
      db,
      userId: user.userId,
      feature: "intake",
      credits,
      title: request.name?.trim() || (ref ? `${ref.owner}/${ref.repo}` : undefined),
      inputSummary: { method: request.method, url: ref ? `https://github.com/${ref.owner}/${ref.repo}` : undefined },
      worstCase: { tier: "strong", inputChars, maxOutputTokens: 12_000 },
      emit,
      execute: async ({ runId, signal }) => {
        // Fetched after the reservation: every attempt counts toward the daily limit, and GitHub failures refund.
        if (ref) emit({ type: "progress", step: "Reading repository", detail: `${ref.owner}/${ref.repo}` });
        const snapshot = ref
          ? await fetchRepoSnapshot(ref, {
              signal: AbortSignal.timeout(REPO_FETCH_TIMEOUT_MS),
              onProgress: (_step, _detail, files) => {
                if (files) emit({ type: "progress", step: `Selected ${files.length} files`, files });
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

        emit({ type: "progress", step: "Drafting model", runId });
        const drafted = await generateStructured({
          feature: "intake",
          tier: "strong",
          userId: user.userId,
          instructions: intakeInstructions(),
          prompt: intakePrompt({
            name: request.name,
            context: request.context,
            documents,
            listing: snapshot?.listing,
          }),
          schema: IntakeDraftSchema,
          maxOutputTokens: 12_000,
          timeoutMs: 200_000,
          signal,
        });

        emit({ type: "progress", step: "Checking the draft", runId });
        const { draft, dropped } = normalizeDraft(drafted.output, { allowedPaths });
        if (draft.components.length === 0) throw new AiFailure("invalid_output");

        return {
          output: { draft, dropped, source },
          model: drafted.model,
          inputTokens: drafted.inputTokens,
          outputTokens: drafted.outputTokens,
          costUsd: drafted.costUsd,
        };
      },
    });

    if (!result.ok) {
      emit(runFailureEvent(result));
      return;
    }
    emit({ type: "result", runId: result.runId, data: result.output });
  });
}
