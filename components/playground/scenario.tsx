"use client";

import Link from "next/link";
import { useDraft } from "@/components/exercise/use-draft";
import {
  describeEdit,
  describeGoal,
  parseScenarioProgress,
  type GoalResult,
  type Scenario,
  type ScenarioCheck,
  type ScenarioProgress,
} from "@/lib/domain/scenarios";

export type ScenarioSource = { id: string; title: string; url: string; company: string };

/** Solved scenarios, kept in this browser alongside the playground's designs. */
export function useScenarioProgress() {
  return useDraft<ScenarioProgress>("playground-scenarios", parseScenarioProgress, () => ({}));
}

/**
 * What has to hold, measured on the design as it stands. Replaces the summary plate while a scenario is
 * open; announces itself to screen readers when the count of goals met changes.
 */
export function GoalPlate({
  check,
  scenario,
  opLabel,
  labelOf,
  isDatabase,
  onPick,
}: {
  check: ScenarioCheck;
  scenario: Scenario;
  opLabel: (id: string) => string;
  labelOf: (id: string) => string;
  isDatabase: (id: string) => boolean;
  onPick: (id: string) => void;
}) {
  const met = check.goals.filter((g) => g.met).length;
  return (
    <section aria-labelledby="goals" className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="goals" className="kicker">
          has to hold
        </h2>
        <p className="font-mono text-[0.75rem] text-ink-3" aria-live="polite" aria-atomic="true">
          {check.passed ? (
            <span className="text-signal-strong">
              {check.goals.length === 1 ? "It holds" : check.goals.length === 2 ? "Both hold" : `All ${check.goals.length} hold`}
            </span>
          ) : (
            `${met} of ${check.goals.length} hold`
          )}
        </p>
      </div>
      <ul className="plate plate-grid mt-2 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
        {check.goals.map((g, i) => (
          <GoalCell
            key={`${scenario.id}-${i}`}
            result={g}
            text={describeGoal(g.goal, opLabel, labelOf, isDatabase)}
            onPick={onPick}
          />
        ))}
      </ul>
    </section>
  );
}

function GoalCell({ result, text, onPick }: { result: GoalResult; text: string; onPick: (id: string) => void }) {
  const tone = result.met ? "text-signal-strong" : "text-signal-gap";
  const first = result.componentIds[0];
  return (
    <li className="px-4 py-3">
      <p className="flex items-start gap-2 text-[0.8125rem] leading-snug text-ink-2">
        <span className={`led ${result.met ? "led-strong" : "led-gap"} mt-[0.4rem]`} aria-hidden="true" />
        <span>
          <span className="sr-only">{result.met ? "Holds: " : "Does not hold: "}</span>
          {text}
        </span>
      </p>
      <p className="mt-1.5 pl-[0.9rem] font-mono text-[0.9375rem] tabular-nums">
        <span className={tone}>{result.actual}</span>
        <span className="ml-2 text-[0.75rem] text-ink-3">{result.target}</span>
      </p>
      {!result.met && first && (
        <button
          type="button"
          className="mt-1 pl-[0.9rem] text-[0.75rem] text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
          onClick={() => onPick(first)}
        >
          Show where
        </button>
      )}
    </li>
  );
}

/** How far into the help someone has gone on one scenario. Kept by the page, so closing a part keeps it. */
export type Help = { hints: number; answer: boolean };

/** With nothing selected in a scenario: hints one at a time, then an answer. */
export function Stuck({
  scenario,
  help,
  onHelp,
  labelOf,
  isDatabase,
  onPick,
  onReveal,
}: {
  scenario: Scenario;
  help: Help;
  onHelp: (help: Help) => void;
  labelOf: (id: string) => string;
  isDatabase: (id: string) => boolean;
  onPick: (id: string) => void;
  onReveal: () => void;
}) {
  const hints = scenario.hints.slice(0, help.hints);
  return (
    <div className="panel p-4 sm:p-5">
      <p className="kicker">stuck?</p>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">
        Click a part to size it, put something in front of it, or break it. Everything re-checks as you go.
      </p>
      {hints.length > 0 && (
        <ol className="mt-4 space-y-3">
          {hints.map((h, i) => (
            <li key={i} className="flex gap-2.5 text-[0.8125rem] leading-relaxed text-ink-2">
              <span className="font-mono text-[0.75rem] text-ink-3">{i + 1}</span>
              <span>
                {h.text}
                {h.componentIds && h.componentIds.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {h.componentIds.map((id) => (
                      <button key={id} type="button" className="btn btn-ghost btn-sm -ml-1" onClick={() => onPick(id)}>
                        Open {labelOf(id)}
                      </button>
                    ))}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {help.hints < scenario.hints.length ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onHelp({ ...help, hints: help.hints + 1 })}
          >
            {help.hints === 0 ? "A hint" : "Another hint"}
          </button>
        ) : (
          !help.answer && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                onHelp({ ...help, answer: true });
                onReveal();
              }}
            >
              Show one answer
            </button>
          )
        )}
      </div>
      {help.answer && (
        <div className="mt-4 border-t border-rule-soft pt-4">
          <p className="kicker">one answer</p>
          <ul className="mt-2 space-y-1.5 text-[0.8125rem] leading-relaxed text-ink-2">
            {scenario.solution.map((edit, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="text-ink-3">
                  –
                </span>
                {describeEdit(edit, labelOf, isDatabase)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-3">
            Not the only one. Make the changes yourself to see the debrief.
          </p>
        </div>
      )}
    </div>
  );
}

/** What passing taught: the cost, the real system, the interview line, and the model's limits. */
export function Debrief({
  scenario,
  sources,
  concepts,
  next,
  onNext,
}: {
  scenario: Scenario;
  sources: Record<string, ScenarioSource>;
  concepts: Record<string, { title: string; summary: string }>;
  next: Scenario | undefined;
  onNext: (id: string | null) => void;
}) {
  const d = scenario.debrief;
  const rows: { label: string; body: string }[] = [
    { label: "What it cost", body: d.cost },
    { label: "In the real system", body: d.realWorld },
    { label: "Say it in an interview", body: d.interview },
    { label: "What this model leaves out", body: d.limits },
  ];
  return (
    <section aria-labelledby="debrief" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="debrief" className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          <span className="led led-strong" aria-hidden="true" />
          It holds. Here is what that took
        </h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNext(next?.id ?? null)}>
          {next ? `Next: ${next.title}` : "Back to free play"}
        </button>
      </div>
      <dl className="plate mt-3">
        {rows.map((row) => (
          <div key={row.label} className="plate-row grid gap-1 px-4 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6 sm:px-5">
            <dt className="text-[0.8125rem] font-medium text-ink-3">{row.label}</dt>
            <dd className="text-[0.875rem] leading-relaxed text-ink-2">{row.body}</dd>
          </div>
        ))}
        <div className="plate-row grid gap-1 px-4 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6 sm:px-5">
          <dt className="text-[0.8125rem] font-medium text-ink-3">Read</dt>
          <dd className="flex flex-col gap-1.5 text-[0.875rem]">
            {d.sourceIds
              .map((id) => sources[id])
              .filter((s): s is ScenarioSource => Boolean(s))
              .map((s) => (
                <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="text-ink-2 hover:text-ink">
                  {s.company}: {s.title} ↗
                </a>
              ))}
            <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]">
              {d.conceptIds
                .filter((id) => concepts[id])
                .map((id) => (
                  <Link key={id} href={`/concepts/${id}`} className="concept-link text-ink-2">
                    {concepts[id]?.title}
                  </Link>
                ))}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
