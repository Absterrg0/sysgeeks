"use client";

import type { ReactNode } from "react";
import { StreamStatus } from "@/components/ai";
import type { AiEvent } from "@/lib/ai/events";

export type ProgressStep = Extract<AiEvent, { type: "progress" }>;

/** The progress of a run in flight: the current step on the status row, earlier steps listed under it. Unmount it when the run ends. */
export function ProgressSteps({
  steps,
  elapsed,
  onStop,
}: {
  steps: readonly ProgressStep[];
  elapsed?: ReactNode;
  onStop?: () => void;
}) {
  const current = steps.at(-1);
  const earlier = steps.slice(0, -1);
  return (
    <div className="grid gap-2">
      <StreamStatus message={current ? (current.detail ?? current.step) : "Starting…"} elapsed={elapsed} onStop={onStop} />
      {earlier.length > 0 && (
        <ol className="grid gap-1 text-small text-ink-3">
          {earlier.map((event, i) => (
            <li key={`${event.step}-${i}`} className="flex gap-2">
              <span aria-hidden="true">✓</span>
              {event.detail ?? event.step}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
