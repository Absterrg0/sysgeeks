import "server-only";
import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output } from "ai";
import { ZodError, type ZodType } from "zod";
import { AiFailure, type AiErrorCode } from "@/lib/ai/errors";
import { env } from "@/lib/config";
import { estimateCostUsd, MODELS, type Tier } from "./models";

const DEFAULT_TIMEOUT_MS = 240_000;
/** Output assumed for a failed call that reports no usage. */
const DEFAULT_MAX_OUTPUT_TOKENS = 16_000;

export type GenerateStructuredOptions<T> = {
  feature: string;
  tier: Tier;
  userId: string;
  instructions: string;
  prompt: string;
  schema: ZodType<T>;
  maxOutputTokens?: number;
  /** Budget shared by the primary attempt and the fallback, so both fit inside the route's maxDuration. */
  timeoutMs?: number;
  /** Outer cancellation, e.g. the metered runner's signal. */
  signal?: AbortSignal;
};

export type StructuredResult<T> = {
  output: T;
  model: string;
  /** Summed over every attempt, including a discarded primary attempt. */
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

type Spend = { model: string; inputTokens: number; outputTokens: number; costUsd: number };

class InvalidOutput extends Error {}

function isInvalidOutput(error: unknown): boolean {
  return (
    NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error) || error instanceof ZodError
  );
}

/** Gateway-reported cost in USD for one call, when the gateway sends one. */
function gatewayCostUsd(providerMetadata: unknown): number | undefined {
  const cost = (providerMetadata as { gateway?: { cost?: unknown } } | undefined)?.gateway?.cost;
  const usd = typeof cost === "string" ? Number(cost) : cost;
  return typeof usd === "number" && Number.isFinite(usd) && usd >= 0 ? usd : undefined;
}

function spendOf(model: string, inputTokens: number, outputTokens: number, providerMetadata?: unknown): Spend {
  return {
    model,
    inputTokens,
    outputTokens,
    costUsd: gatewayCostUsd(providerMetadata) ?? estimateCostUsd(model, inputTokens, outputTokens),
  };
}

/** Charged when the provider reports no usage: the prompt in tokens, plus the full output budget. */
function assumedSpend(
  opts: Pick<GenerateStructuredOptions<unknown>, "instructions" | "prompt" | "maxOutputTokens">,
  model: string,
): Spend {
  const inputTokens = Math.ceil((opts.instructions.length + opts.prompt.length) / 4);
  return spendOf(model, inputTokens, opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS);
}

function invalidOutputSpend(
  error: unknown,
  opts: Pick<GenerateStructuredOptions<unknown>, "instructions" | "prompt" | "maxOutputTokens">,
  model: string,
): Spend {
  const usage = NoObjectGeneratedError.isInstance(error) ? error.usage : undefined;
  if (usage?.inputTokens != null && usage.outputTokens != null) {
    return spendOf(model, usage.inputTokens, usage.outputTokens);
  }
  return assumedSpend(opts, model);
}

function sumSpend(spent: Spend[]): Omit<Spend, "model"> {
  return spent.reduce(
    (sum, s) => ({
      inputTokens: sum.inputTokens + s.inputTokens,
      outputTokens: sum.outputTokens + s.outputTokens,
      costUsd: sum.costUsd + s.costUsd,
    }),
    { inputTokens: 0, outputTokens: 0, costUsd: 0 },
  );
}

async function callModel<T>(
  opts: GenerateStructuredOptions<T>,
  model: string,
  fallback: string,
  signal: AbortSignal,
  spent: Spend[],
): Promise<{ output: T; modelId: string }> {
  try {
    const result = await generateText({
      model,
      instructions: opts.instructions,
      prompt: opts.prompt,
      output: Output.object({ schema: opts.schema }),
      maxOutputTokens: opts.maxOutputTokens,
      maxRetries: 1,
      abortSignal: signal,
      providerOptions: {
        gateway: {
          models: [fallback],
          user: opts.userId,
          tags: [`feature:${opts.feature}`],
          disallowPromptTraining: true,
          zeroDataRetention: env.zdr,
        },
      },
    });
    spent.push(spendOf(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0, result.providerMetadata));
    return { output: result.output, modelId: result.response.modelId };
  } catch (error) {
    if (signal.aborted) {
      spent.push(assumedSpend(opts, model));
      throw new AiFailure("timeout");
    }
    if (isInvalidOutput(error)) {
      spent.push(invalidOutputSpend(error, opts, model));
      throw new InvalidOutput();
    }
    spent.push(assumedSpend(opts, model));
    throw new AiFailure("model_failed");
  }
}

export async function generateStructured<T>(opts: GenerateStructuredOptions<T>): Promise<StructuredResult<T>> {
  const { primary, fallback } = MODELS[opts.tier];
  const deadline = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([deadline, opts.signal]) : deadline;
  const spent: Spend[] = [];
  try {
    const { output, modelId } = await callModel(opts, primary, fallback, signal, spent).catch((error: unknown) => {
      if (!(error instanceof InvalidOutput)) throw error;
      return callModel(opts, fallback, fallback, signal, spent);
    });
    return { output, model: modelId, ...sumSpend(spent) };
  } catch (error) {
    const code: AiErrorCode =
      error instanceof AiFailure ? error.code : error instanceof InvalidOutput ? "invalid_output" : "model_failed";
    const last = spent.at(-1);
    throw new AiFailure(code, { usage: last ? { model: last.model, ...sumSpend(spent) } : undefined });
  }
}
