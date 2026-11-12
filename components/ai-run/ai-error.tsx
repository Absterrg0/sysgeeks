"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { openAiKeySettings } from "@/components/ai-key/events";
import { Callout } from "@/components/feedback";
import { AI_ERROR_MESSAGES, type AiErrorCode } from "@/lib/ai/errors";

const KEY_ACTION = (
  <button type="button" className="link" onClick={openAiKeySettings}>
    Check your key and model
  </button>
);

const NEXT_STEP: Record<AiErrorCode, ReactNode> = {
  key_missing: (
    <button type="button" className="link" onClick={openAiKeySettings}>
      Add your API key
    </button>
  ),
  key_invalid: KEY_ACTION,
  key_forbidden: KEY_ACTION,
  model_not_found: KEY_ACTION,
  provider_limited: "Wait a minute and try again, or check the spending limit and credit on your provider account.",
  provider_unavailable: "Try again in a few minutes, or switch to another model.",
  network: "Check your connection, and that an extension or network filter isn't blocking your provider.",
  ai_unavailable: "The rest of the site works as normal.",
  input_invalid: "Check the fields and try again.",
  input_too_large: "Shorten the text or pick fewer files.",
  repo_not_found: "Check the owner and repository name, or paste the README instead.",
  repo_private: "Paste the README or describe the system instead.",
  repo_empty: "Paste the README or describe the system instead.",
  github_unavailable: "GitHub allows 60 requests an hour from one address. Paste the README instead, or try again later.",
  model_failed: "Try again in a moment.",
  invalid_output: (
    <>
      Try again, or pick a stronger model.{" "}
      <Link href="/ai#models" className="link">
        Which models work best
      </Link>
    </>
  ),
  timeout: "Try again with less input, or a faster model.",
  aborted: "Run it again when you're ready.",
};

/** A failed AI run: what went wrong, what the provider said, and what to do next. */
export function AiError({
  code,
  detail,
  onRetry,
}: {
  code: AiErrorCode;
  /** The provider's own message, when it sent one. */
  detail?: string;
  /** @deprecated Ignored: nothing is charged, so nothing is refunded. */
  refunded?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div role="alert">
      <Callout tone="failure" title={AI_ERROR_MESSAGES[code]}>
        {detail && (
          <p>
            Your provider said: <q>{detail}</q>
          </p>
        )}
        <p>{NEXT_STEP[code]}</p>
        {onRetry && code !== "key_missing" && (
          <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={onRetry}>
            Try again
          </button>
        )}
      </Callout>
    </div>
  );
}
