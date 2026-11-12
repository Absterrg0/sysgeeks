/**
 * One structured model call from the browser with the learner's key, and the errors it can end in,
 * translated into something the learner can act on.
 */
import { APICallError, generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output, RetryError } from "ai";
import { ZodError, type ZodType } from "zod";
import { AiFailure } from "./errors";
import { languageModel, type ModelSettings, STRUCTURED_OUTPUT_OPTIONS } from "./model";
import { codeForStatus, providerMessage } from "./provider-errors";

const DEFAULT_TIMEOUT_MS = 240_000;

export type GenerateStructuredOptions<T> = {
  settings: ModelSettings;
  instructions: string;
  prompt: string;
  schema: ZodType<T>;
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** The learner pressed Stop. */
  signal?: AbortSignal;
};

export type StructuredResult<T> = { output: T; model: string };

class InvalidOutput extends Error {}

function isInvalidOutput(error: unknown): boolean {
  return (
    NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error) || error instanceof ZodError
  );
}

/** Asks for the object; an answer that fails the schema is asked for once more before giving up. */
export async function generateStructured<T>(opts: GenerateStructuredOptions<T>): Promise<StructuredResult<T>> {
  const deadline = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([deadline, opts.signal]) : deadline;
  const model = await languageModel(opts.settings);

  const attempt = async () => {
    try {
      const result = await generateText({
        model,
        instructions: opts.instructions,
        prompt: opts.prompt,
        output: Output.object({ schema: opts.schema }),
        maxOutputTokens: opts.maxOutputTokens,
        maxRetries: 1,
        abortSignal: signal,
        providerOptions: STRUCTURED_OUTPUT_OPTIONS,
      });
      return { output: result.output, model: result.response.modelId || opts.settings.model };
    } catch (error) {
      if (isInvalidOutput(error)) throw new InvalidOutput();
      throw error;
    }
  };

  try {
    return await attempt().catch((error: unknown) => {
      if (error instanceof InvalidOutput) return attempt();
      throw error;
    });
  } catch (error) {
    if (error instanceof InvalidOutput) throw new AiFailure("invalid_output");
    if (opts.signal?.aborted) throw new AiFailure("aborted");
    if (deadline.aborted) throw new AiFailure("timeout");
    throw toAiFailure(error, opts.settings.apiKey);
  }
}

/** Maps whatever the SDK threw to a code the learner can act on. */
export function toAiFailure(error: unknown, apiKey: string): AiFailure {
  if (error instanceof AiFailure) return error;
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(cause)) {
    if (cause.statusCode === undefined) return new AiFailure("network");
    return new AiFailure(codeForStatus(cause.statusCode, cause.responseBody ?? ""), {
      detail: providerMessage(cause.responseBody, apiKey) ?? undefined,
    });
  }
  // fetch rejects with a TypeError when CORS or the network stops the request.
  if (cause instanceof TypeError) return new AiFailure("network");
  if (isInvalidOutput(cause)) return new AiFailure("invalid_output");
  return new AiFailure("model_failed");
}
