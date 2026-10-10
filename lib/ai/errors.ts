/** Client-safe: no zod, no server imports. */
export const AI_ERROR_MESSAGES = {
  auth_required: "Sign in to use this feature.",
  ai_unavailable: "AI features are unavailable right now.",
  insufficient_credits: "You don't have enough credits for this run.",
  rate_limited: "You've reached today's limit for this feature. Try again tomorrow.",
  budget_exhausted: "Free AI runs are paused for today. Try again tomorrow.",
  input_invalid: "That input isn't valid.",
  input_too_large: "That input is too large.",
  repo_not_found: "We couldn't find that public GitHub repository.",
  repo_private: "That repository is private. Only public repositories are supported.",
  repo_empty: "That repository has no readable files.",
  github_unavailable: "GitHub is unavailable right now. Try again shortly.",
  model_failed: "The AI model failed to respond. Try again.",
  invalid_output: "The AI returned an answer we couldn't use. Try again.",
  timeout: "The request took too long. Try again.",
  too_many_running: "You already have two AI runs in progress. Wait for one to finish.",
} as const;

/** Sent to the user when a run's credits could not be returned right away. */
export const REFUND_PENDING_MESSAGE = "Your credits will be returned automatically within 10 minutes.";

export type AiErrorCode = keyof typeof AI_ERROR_MESSAGES;

/** Model usage spent before a failure, so the run can still be charged. Carries no content. */
export interface AiUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** USD. The metered runner estimates it from the tokens when absent. */
  costUsd?: number;
}

export class AiFailure extends Error {
  readonly code: AiErrorCode;
  readonly refunded: boolean;
  readonly usage?: AiUsage;

  constructor(code: AiErrorCode, options: { refunded?: boolean; usage?: AiUsage } = {}) {
    super(AI_ERROR_MESSAGES[code]);
    this.name = "AiFailure";
    this.code = code;
    this.refunded = options.refunded ?? false;
    this.usage = options.usage;
  }
}
