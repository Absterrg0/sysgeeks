"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { SignalDot } from "@/components/ui";
import { DIMENSION_LABELS, DIMENSIONS, type Dimension } from "@/lib/domain/taxonomy";
import { exerciseStatus, type ExerciseStatus } from "@/lib/domain/understanding";
import type { ExerciseRef } from "@/lib/domain/learner";
import { useLearnerState } from "@/lib/store/learner-store";

export type PracticeExercise = {
  key: string;
  ref: ExerciseRef;
  title: string;
  source: string;
  href: string;
  dimensions: Dimension[];
};

const ORDER: Record<ExerciseStatus, number> = {
  gap: 0,
  partial: 1,
  "awaiting-assessment": 2,
  unattempted: 3,
  strong: 4,
};
const STATUS_TEXT: Record<ExerciseStatus, string> = {
  gap: "Gap",
  partial: "Partial",
  "awaiting-assessment": "Needs assessment",
  unattempted: "New",
  strong: "Strong",
};

/** Every exercise that trains one dimension, ordered by where practice is most useful. */
export function DimensionPractice({ exercises }: { exercises: PracticeExercise[] }) {
  const state = useLearnerState();
  const [dimension, setDimensionState] = useState<Dimension>("break");
  const [showAll, setShowAll] = useState(false);
  const setDimension = (next: Dimension) => {
    setDimensionState(next);
    setShowAll(false);
  };
  const list = exercises
    .filter((e) => e.dimensions.includes(dimension))
    .map((e) => ({
      e,
      status: state ? exerciseStatus(state.attempts, e.ref) : ("unattempted" as const),
    }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = (DIMENSIONS.indexOf(dimension) + step + DIMENSIONS.length) % DIMENSIONS.length;
    const next = DIMENSIONS[index] ?? dimension;
    setDimension(next);
    document.getElementById(`dimension-tab-${next}`)?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Dimension" onKeyDown={onTabKey} className="tabs">
        {DIMENSIONS.map((d) => (
          <button
            key={d}
            id={`dimension-tab-${d}`}
            type="button"
            role="tab"
            aria-selected={d === dimension}
            aria-controls="dimension-panel"
            tabIndex={d === dimension ? 0 : -1}
            onClick={() => setDimension(d)}
            className="tab"
          >
            {DIMENSION_LABELS[d].label}
          </button>
        ))}
      </div>
      <div id="dimension-panel" role="tabpanel" aria-labelledby={`dimension-tab-${dimension}`}>
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-2">{DIMENSION_LABELS[dimension].description}</p>
        <ul className="plate mt-4" aria-live="polite">
          {(showAll ? list : list.slice(0, 8)).map(({ e, status }) => (
            <li key={e.key} className="plate-row">
              <Link href={e.href} className="group flex items-center justify-between gap-4 px-5 py-3">
                <span className="min-w-0 truncate text-[0.8125rem]">
                  <span className="font-medium text-ink transition-colors group-hover:text-accent">{e.title}</span>
                  <span className="text-ink-3" aria-hidden="true">
                    {" · "}
                  </span>
                  <span className="text-ink-3">{e.source}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[0.75rem] text-ink-2">
                  <SignalDot
                    signal={status === "strong" || status === "partial" || status === "gap" ? status : null}
                    label={STATUS_TEXT[status]}
                  />
                  <span aria-hidden="true">{STATUS_TEXT[status]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {list.length > 8 && !showAll && (
          <button type="button" className="btn btn-ghost btn-sm mt-2 -ml-2.5" onClick={() => setShowAll(true)}>
            Show all {list.length}
          </button>
        )}
      </div>
    </div>
  );
}
