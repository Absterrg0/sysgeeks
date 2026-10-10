"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SignalBadge, SignalMeter } from "@/components/ui";
import { exerciseKey, type ExerciseRef } from "@/lib/domain/learner";
import { daysAgo, daysUntil, reviewQueue } from "@/lib/domain/review";
import { DIMENSION_LABELS, DIMENSIONS } from "@/lib/domain/taxonomy";
import { awaitingAssessment, byConcept, byDimension, latestEvidence } from "@/lib/domain/understanding";
import { labelFor, type CuratedLabels } from "@/lib/exercise-labels";
import { useLearnerState } from "@/lib/store/learner-store";
import { useNow } from "@/lib/use-now";

export type ReviewSystem = { id: string; title: string; stages: { id: string; title: string }[] };

/** The three practice tools, each opening its own tab. */
const TOOLS: { hash: string; title: string; body: string; meta: string; icon: ReactNode }[] = [
  {
    hash: "session",
    title: "Mock interview",
    body: "Explain, decide, break and defend, then an honest debrief.",
    meta: "30, 45 or 60 min",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
        <circle cx="7.5" cy="8.5" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7.5 5.6v2.9h2.4M5.6 1.3h3.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    hash: "claims",
    title: "Claim check",
    body: "Statements from design reviews. Does each hold, fail, or depend?",
    meta: "8 claims · 3 min",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
        <path d="M2.5 8l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    hash: "dimension",
    title: "Drill a skill",
    body: "Every exercise that trains one skill, weakest evidence first.",
    meta: "6 skills",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
        <path d="M7.5 1.5l5 2.9v5.8l-5 2.9-5-2.9V4.4z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function Ring({ value, total }: { value: number; total: number }) {
  const r = 22;
  const length = 2 * Math.PI * r;
  const share = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true" className="shrink-0">
      <circle cx="27" cy="27" r={r} fill="none" stroke="var(--rule-strong)" strokeWidth="5" />
      {share > 0 && (
        <circle
          cx="27"
          cy="27"
          r={r}
          fill="none"
          stroke="var(--accent-solid)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(2, share * length)} ${length}`}
          transform="rotate(-90 27 27)"
        />
      )}
    </svg>
  );
}

function Bar({ value, total }: { value: number; total: number }) {
  return (
    <span className="block h-1 overflow-hidden rounded-full bg-rule-strong/60">
      <span className="block h-full rounded-full bg-accent-solid" style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }} />
    </span>
  );
}

/**
 * The review dashboard: the one thing to do next, the practice tools, what is due, and on the side where you
 * stand by system and by skill.
 */
export function ReviewOverview({
  systems,
  conceptCount,
  exerciseCount,
  curated,
  onOpen,
}: {
  systems: ReviewSystem[];
  conceptCount: number;
  exerciseCount: number;
  curated: CuratedLabels;
  /** Switches to one of the other tabs. */
  onOpen: (hash: string) => void;
}) {
  const state = useLearnerState();
  const now = useNow();
  if (!state || now === null) {
    return (
      <div aria-busy="true" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <div className="sheet h-20" />
          <div className="sheet h-40" />
        </div>
        <div className="sheet h-72" />
      </div>
    );
  }

  const latest = latestEvidence(state.attempts);
  const label = (ref: ExerciseRef) => labelFor(ref, curated, state.projects);
  const answeredStages = new Set(
    [...latest.values()].flatMap((e) => (e.exercise.kind === "stage" ? [`${e.exercise.investigationId}/${e.exercise.stageId}`] : [])),
  );
  const progress = systems.map((s) => ({
    ...s,
    answered: s.stages.filter((st) => answeredStages.has(`${s.id}/${st.id}`)).length,
  }));
  const started = progress.filter((s) => s.answered > 0);
  // Up next: the first stage you have not answered in a system you started, or the very first stage.
  const current = started.find((s) => s.answered < s.stages.length) ?? progress.find((s) => s.answered < s.stages.length);
  const nextStage = current?.stages.find((st) => !answeredStages.has(`${current.id}/${st.id}`));
  const nextIndex = current && nextStage ? current.stages.indexOf(nextStage) : -1;

  const queue = reviewQueue(state.attempts, now);
  const due = queue.due.filter((item) => label(item.exercise) !== null);
  const upcoming = queue.upcoming.filter((item) => label(item.exercise) !== null);
  const awaiting = awaitingAssessment(state.attempts)
    .map((a) => a.exercise)
    .filter((ref) => label(ref) !== null);
  const dimensions = byDimension(latest);
  const conceptsWithEvidence = byConcept(latest).size;
  const firstDue = due[0] ? label(due[0].exercise) : null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-8">
        {firstDue ? (
          <UpNext
            href={firstDue.href}
            kicker={`${due.length} answer${due.length === 1 ? "" : "s"} due for review`}
            title={firstDue.title}
            detail={firstDue.source}
            cta="Review"
          />
        ) : current && nextStage ? (
          <UpNext
            href={`/investigations/${current.id}/${nextStage.id}`}
            kicker={current.answered > 0 ? "Continue where you left off" : "Up next"}
            title={current.title}
            detail={`Stage ${nextIndex + 1}, ${nextStage.title}`}
            cta={current.answered > 0 ? "Continue" : "Start"}
          />
        ) : null}

        <section aria-labelledby="practise">
          <h2 id="practise" className="mb-2.5 text-[0.8125rem] font-semibold">
            Practise
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {TOOLS.map((tool) => (
              <button
                key={tool.hash}
                type="button"
                onClick={() => onOpen(tool.hash)}
                className="sheet group flex min-h-36 flex-col p-4 text-left"
              >
                <span className="grid size-8 place-items-center rounded-lg text-ink-2 shadow-[inset_0_0_0_1px_var(--rule-strong)] group-hover:text-accent">
                  {tool.icon}
                </span>
                <span className="mt-3 text-[0.875rem] font-semibold">{tool.title}</span>
                <span className="mt-1 text-[0.8125rem] leading-snug text-ink-3">{tool.body}</span>
                <span className="mt-auto flex items-center justify-between pt-3 text-[0.75rem] text-ink-3">
                  {tool.meta}
                  <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                    →
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="due">
          <h2 id="due" className="mb-2.5 flex items-baseline gap-2 text-[0.8125rem] font-semibold">
            Due for review <span className="font-mono text-[0.6875rem] font-normal text-ink-3">{due.length + awaiting.length}</span>
          </h2>
          {due.length + awaiting.length === 0 ? (
            <div className="sheet px-5 py-8 text-center">
              <p className="text-[0.875rem] text-ink-2">Nothing is due.</p>
              <p className="mt-1 text-[0.8125rem] text-ink-3">
                {upcoming[0]
                  ? `The next review is ${daysUntil(upcoming[0].dueAt, now)}${upcoming.length > 1 ? `, with ${upcoming.length - 1} more after it` : ""}.`
                  : "An answer comes back a day to a week after you give it, sooner when it was weak."}
              </p>
            </div>
          ) : (
            <ul className="sheet">
              {awaiting.map((ref) => {
                const l = label(ref);
                if (!l) return null;
                return (
                  <li key={exerciseKey(ref)} className="sheet-row">
                    <Link href={l.href} className="flex items-center justify-between gap-4 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[0.875rem] font-medium">{l.title}</span>
                        <span className="block truncate text-[0.75rem] text-ink-3">{l.source}</span>
                      </span>
                      <span className="chip-flat shrink-0">Needs your assessment</span>
                    </Link>
                  </li>
                );
              })}
              {due.map((item) => {
                const l = label(item.exercise);
                if (!l) return null;
                return (
                  <li key={item.key} className="sheet-row">
                    <Link href={l.href} className="flex items-center justify-between gap-4 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[0.875rem] font-medium">{l.title}</span>
                        <span className="block truncate text-[0.75rem] text-ink-3">
                          {l.source} · answered {daysAgo(item.answeredAt, now)}
                        </span>
                      </span>
                      <SignalBadge signal={item.signal} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-3" aria-label="Where you stand">
        <div className="sheet p-4">
          <div className="flex items-center gap-3.5">
            <Ring value={latest.size} total={exerciseCount} />
            <div>
              <p className="font-mono text-[1.25rem] tabular-nums">
                {latest.size}
                <span className="text-[0.8125rem] text-ink-3"> / {exerciseCount}</span>
              </p>
              <p className="text-[0.75rem] text-ink-3">exercises answered</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-rule-soft pt-3 text-[0.75rem]">
            <div>
              <dt className="text-ink-3">Systems started</dt>
              <dd className="mt-0.5 font-mono text-[0.875rem] tabular-nums">
                {started.length} <span className="text-ink-3">/ {systems.length}</span>
              </dd>
            </div>
            <div>
              <dt className="text-ink-3">Concepts touched</dt>
              <dd className="mt-0.5 font-mono text-[0.875rem] tabular-nums">
                {conceptsWithEvidence} <span className="text-ink-3">/ {conceptCount}</span>
              </dd>
            </div>
          </dl>
        </div>

        <section aria-labelledby="by-system" className="sheet p-4">
          <h2 id="by-system" className="mb-2 flex justify-between text-[0.8125rem] font-semibold">
            By system <span className="font-normal text-ink-3 text-[0.75rem]">stages</span>
          </h2>
          <ul className="space-y-0.5">
            {progress.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/investigations/${s.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_3.5rem_2.25rem] items-center gap-2.5 py-1 text-[0.75rem] text-ink-2 hover:text-ink"
                >
                  <span className="truncate">{s.title}</span>
                  <Bar value={s.answered} total={s.stages.length} />
                  <span className="text-right font-mono text-[0.6875rem] text-ink-3 tabular-nums">
                    {s.answered}/{s.stages.length}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="by-skill" className="sheet p-4">
          <h2 id="by-skill" className="mb-2 flex justify-between text-[0.8125rem] font-semibold">
            By skill
            <button type="button" className="text-[0.75rem] font-normal text-ink-3 hover:text-ink" onClick={() => onOpen("dimension")}>
              Drill one
            </button>
          </h2>
          <ul className="space-y-1.5">
            {DIMENSIONS.map((d) => (
              <li key={d} className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-2.5 text-[0.75rem] text-ink-2">
                <span title={DIMENSION_LABELS[d].description}>{DIMENSION_LABELS[d].label}</span>
                {dimensions[d].total > 0 ? (
                  <SignalMeter counts={dimensions[d].counts} label={DIMENSION_LABELS[d].label} />
                ) : (
                  <span className="text-[0.6875rem] text-ink-3">no evidence yet</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function UpNext({ href, kicker, title, detail, cta }: { href: string; kicker: string; title: string; detail: string; cta: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl bg-accent-soft px-4 py-3.5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent-solid)_28%,transparent)] sm:px-5"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg text-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent-solid)_40%,transparent)]">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M4.5 3v8l6.5-4z" fill="currentColor" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.75rem] text-ink-3">{kicker}</span>
        <span className="block truncate text-[0.9375rem] font-medium">
          {title} <span className="font-normal text-ink-3">· {detail}</span>
        </span>
      </span>
      <span className="btn btn-accent btn-sm shrink-0">{cta}</span>
    </Link>
  );
}
