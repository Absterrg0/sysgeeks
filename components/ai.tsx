import type { ReactNode } from "react";

export type AiKind = "draft" | "review" | "assessed" | "suggestion";

export const AI_LABEL: Record<AiKind, string> = {
  draft: "AI draft",
  review: "AI review",
  assessed: "AI-assessed",
  suggestion: "AI suggestion",
};

/** A dashed square with a filled centre: provisional, not a sparkle. */
export function AiGlyph({ className = "" }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect
        x="0.6"
        y="0.6"
        width="8.8"
        height="8.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 1.5"
      />
      <rect x="3.75" y="3.75" width="2.5" height="2.5" fill="currentColor" />
    </svg>
  );
}

/** Names what the AI did. Every piece of AI output carries one. */
export function AiLabel({ kind }: { kind: AiKind }) {
  return (
    <span className="ai-label">
      <AiGlyph />
      {AI_LABEL[kind]}
    </span>
  );
}

/** The container for AI output: a dashed box with the label, provenance and actions on top. */
export function AiBlock({
  kind,
  provenance,
  actions,
  children,
  className = "",
}: {
  kind: AiKind;
  /** What the AI read, when, and whether you have acted on it, e.g. "Drafted from your README · 8 Oct, 14:02 · not yet reviewed by you". */
  provenance: ReactNode;
  /** Accept, Edit and Dismiss as `.btn-sm` buttons. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ai-block ${className}`}>
      <div className="ai-block-head">
        <AiLabel kind={kind} />
        <p className="mr-auto text-small text-ink-3">{provenance}</p>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/**
 * The status row above streamed content. The live region only announces status;
 * the streamed body is not live, so screen readers don't read every token.
 */
export function StreamStatus({
  message,
  elapsed,
  onStop,
}: {
  message: ReactNode;
  /** Pre-formatted, e.g. "0:12". */
  elapsed?: ReactNode;
  onStop?: () => void;
}) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2.5 text-small">
      <span className="led led-ai led-pulse" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-ink-2">{message}</span>
      {elapsed && <span className="font-mono text-micro text-ink-3 tabular-nums">{elapsed}</span>}
      {onStop && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onStop}>
          Stop
        </button>
      )}
    </div>
  );
}

/** Appended to streamed text while it arrives. Remove it when the stream ends. */
export function StreamCaret() {
  return <span className="stream-caret" aria-hidden="true" />;
}
