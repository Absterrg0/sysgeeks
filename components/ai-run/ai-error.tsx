"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Callout } from "@/components/feedback";
import { AI_ERROR_MESSAGES, type AiErrorCode } from "@/lib/ai/errors";

const NEXT_STEP: Record<AiErrorCode, ReactNode> = {
  auth_required: "Sign in, then run it again.",
  ai_unavailable: "The rest of the site works as normal.",
  insufficient_credits: (
    <Link href="/#pricing" className="link">
      See credit packs
    </Link>
  ),
  rate_limited: "Limits reset each day.",
  budget_exhausted: "Free grading is paused until tomorrow.",
  input_invalid: "Check the fields and try again.",
  input_too_large: "Shorten the text or pick fewer files.",
  repo_not_found: "Check the owner and repository name, or paste the README instead.",
  repo_private: "Paste the README or describe the system instead.",
  repo_empty: "Paste the README or describe the system instead.",
  github_unavailable: "Paste the README instead, or try again in a few minutes.",
  model_failed: "Try again in a moment.",
  invalid_output: "Try again. If it keeps failing, tell us.",
  timeout: "Try again with less input.",
  too_many_running: "Wait for one run to finish, then try again.",
};

/** A failed AI run: what went wrong, what to do next, and whether the credits came back. */
export function AiError({ code, refunded, onRetry }: { code: AiErrorCode; refunded: boolean; onRetry?: () => void }) {
  return (
    <Callout tone="failure" title={AI_ERROR_MESSAGES[code]}>
      {refunded && <p>Your credits were refunded.</p>}
      <p>{NEXT_STEP[code]}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={onRetry}>
          Try again
        </button>
      )}
    </Callout>
  );
}
