/** Client-safe: no zod, no provider imports. */
export const AI_ERROR_MESSAGES = {
  key_missing: "Add your API key to use this.",
  key_invalid: "Your provider rejected the API key.",
  key_forbidden: "Your API key isn't allowed to use this model.",
  model_not_found: "Your provider doesn't offer that model to this key.",
  provider_limited: "Your provider refused the request: rate limit or quota reached.",
  provider_unavailable: "Your provider is overloaded or down right now.",
  network: "Couldn't reach your provider from this browser.",
  ai_unavailable: "AI features are unavailable right now.",
  input_invalid: "That input isn't valid.",
  input_too_large: "That input is too large.",
  repo_not_found: "We couldn't find that public GitHub repository.",
  repo_private: "That repository is private. Only public repositories are supported.",
  repo_empty: "That repository has no readable files.",
  github_unavailable: "GitHub is unavailable right now. Try again shortly.",
  model_failed: "The AI model failed to respond. Try again.",
  invalid_output: "The AI returned an answer we couldn't use. Try again.",
  timeout: "The request took too long. Try again.",
  aborted: "Stopped.",
} as const;

export type AiErrorCode = keyof typeof AI_ERROR_MESSAGES;

export class AiFailure extends Error {
  readonly code: AiErrorCode;
  /** What the provider said, when it said something useful, e.g. "invalid x-api-key". */
  readonly detail?: string;
  /**
   * @deprecated Always false: runs are paid by the learner's own provider account, so nothing is refunded.
   * Kept so callers written for credits still type-check.
   */
  readonly refunded = false;

  constructor(code: AiErrorCode, options: { detail?: string } = {}) {
    super(AI_ERROR_MESSAGES[code]);
    this.name = "AiFailure";
    this.code = code;
    this.detail = options.detail;
  }
}
