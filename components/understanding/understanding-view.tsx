"use client";

import Link from "next/link";
import { SignalBadge, SignalMeter, SIGNAL_LED, STANDING_LABEL, STANDING_SIGNAL } from "@/components/ui";
import type { Competency } from "@/lib/domain/content";
import { DIMENSION_LABELS, DIMENSIONS } from "@/lib/domain/taxonomy";
import { exerciseKey, type ExerciseRef } from "@/lib/domain/learner";
import {
  awaitingAssessment,
  byCompetency,
  byConcept,
  byDimension,
  insights,
  latestEvidence,
  summarize,
  type Insight,
} from "@/lib/domain/understanding";
import { daysAgo, daysUntil, reviewQueue } from "@/lib/domain/review";
import { labelFor, type CuratedLabels } from "@/lib/exercise-labels";
import { useLearnerState } from "@/lib/store/learner-store";
import { useNow } from "@/lib/use-now";

export type InvestigationOutline = {
  id: string;
  title: string;
  stageCount: number;
  firstStageId: string;
  competencies: Competency[];
};

type Props = {
  investigations: InvestigationOutline[];
  concepts: Record<string, string>;
  curated: CuratedLabels;
};

const TONE_MARK: Record<Insight["tone"], string> = {
  strength: SIGNAL_LED.strong,
  gap: SIGNAL_LED.gap,
  note: "led led-idle",
};

function Legend() {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3" aria-hidden="true">
      <span>Counts are</span>
      {(["strong", "partial", "gap"] as const).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={`${SIGNAL_LED[s]} size-1.5`} />
          {s}
        </span>
      ))}
    </p>
  );
}

export function UnderstandingView({ investigations, concepts, curated }: Props) {
  const state = useLearnerState();
  const now = useNow();
  if (!state || now === null) {
    return (
      <div aria-busy="true" className="space-y-4">
        <div className="section">
          <div className="h-64 well" />
        </div>
      </div>
    );
  }

  const latest = latestEvidence(state.attempts);
  const overall = summarize(latest.values());
  const awaiting = awaitingAssessment(state.attempts);
  const label = (ref: ExerciseRef) => labelFor(ref, curated, state.projects);

  if (overall.total === 0) {
    return (
      <div className="section">
        <div className="panel space-y-5 p-6 sm:p-7">
          <p className="kicker flex items-center gap-2.5">
            <span className="led led-off" aria-hidden="true" />
            Where you stand
          </p>
          <p className="max-w-[66ch] text-[0.9375rem] leading-relaxed text-ink-2">
            Nothing here yet, and nothing will be until you answer something. This page does not count visits or minutes.
            It reads the evidence from your answers: which decisions held up, which explanations covered the mechanism,
            which failure scenarios you reasoned through.
          </p>
          {awaiting.length > 0 && (
            <p className="text-[0.875rem] text-ink-2">
              You have {awaiting.length} answer{awaiting.length === 1 ? "" : "s"} waiting for your self-assessment. Finish
              those and they will appear here.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {investigations[0] && (
              <Link
                href={`/investigations/${investigations[0].id}/${investigations[0].firstStageId}`}
                className="btn btn-primary"
              >
                Start with {investigations[0].title}
              </Link>
            )}
            <Link href="/concepts" className="btn btn-secondary">
              Or check a concept
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const dimensions = byDimension(latest);
  const conceptSummaries = [...byConcept(latest)]
    .map(([id, s]) => ({ id, title: concepts[id] ?? id, s }))
    .sort((a, b) => a.s.score - b.s.score || b.s.total - a.s.total);
  const found = insights(latest, {
    concept: (id) => concepts[id],
    source: (ref) => label(ref)?.source ?? "an exercise",
  });
  const queue = reviewQueue(state.attempts, now);
  // Exercises that no longer exist (removed content, deleted projects) cannot be reviewed.
  const due = queue.due.filter((item) => label(item.exercise) !== null);
  const upcoming = queue.upcoming.filter((item) => label(item.exercise) !== null);
  const awaitingRefs = awaiting.map((a) => a.exercise);
  const touched = investigations.filter((inv) =>
    [...latest.values()].some((e) => e.exercise.kind === "stage" && e.exercise.investigationId === inv.id),
  );
  const checked = [...latest.values()].filter((e) => e.evidence.basis === "checked").length;
  const mixed = overall.total - checked - overall.selfAssessed - overall.aiAssessed;
  const strongest = DIMENSIONS.filter((d) => dimensions[d].total > 0).sort(
    (a, b) => dimensions[b].score - dimensions[a].score || dimensions[b].total - dimensions[a].total,
  )[0];

  return (
    <div>
      <section aria-labelledby="summary" className="section">
        <h2 id="summary" className="sr-only">
          Summary
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="tile p-5">
            <p className="kicker">Answers assessed</p>
            <p className="mt-4 font-display text-[2.25rem] leading-none tabular-nums">{overall.total}</p>
            <p className="mt-2 text-[0.8125rem] text-ink-3">Latest answer to each exercise</p>
          </div>
          <div className="tile p-5">
            <p className="kicker">Due for review</p>
            <p className="mt-4 font-display text-[2.25rem] leading-none tabular-nums">{due.length}</p>
            <p className="mt-2 text-[0.8125rem] text-ink-3">
              {awaitingRefs.length > 0
                ? `${awaitingRefs.length} waiting for your assessment`
                : "Nothing waiting for your assessment"}
            </p>
          </div>
          <div className="tile p-5">
            <p className="kicker">Strongest dimension</p>
            <p className="mt-4 font-display text-[2.25rem] leading-none">
              {strongest ? DIMENSION_LABELS[strongest].label : "—"}
            </p>
            <p className="mt-2 text-[0.8125rem] text-ink-3">
              {strongest
                ? `${STANDING_LABEL[dimensions[strongest].standing]} · ${dimensions[strongest].total} ${dimensions[strongest].total === 1 ? "piece" : "pieces"} of evidence`
                : "No evidence yet"}
            </p>
          </div>
        </div>
        <div className="mt-8 max-w-3xl">
          <p className="text-[0.9375rem] leading-relaxed text-ink-2">
            Based on your latest answer to <strong className="font-medium text-ink">{overall.total}</strong> exercise
            {overall.total === 1 ? "" : "s"}: {overall.counts.strong} strong, {overall.counts.partial} partial,{" "}
            {overall.counts.gap} gap.
          </p>
          <p className="mt-2 text-[0.8125rem] text-ink-3">
            {checked} checked against the key · {overall.selfAssessed} self-assessed · {overall.aiAssessed} AI-assessed
            {mixed > 0 ? ` · ${mixed} partly checked, partly assessed` : ""}
          </p>
          {found.length > 0 && (
            <ul className="mt-5 divide-y divide-rule-soft border-y border-rule-soft">
              {found.map((insight) => (
                <li key={insight.id} className="flex gap-3 py-2.5 text-[0.875rem] leading-relaxed">
                  <span className={`${TONE_MARK[insight.tone]} mt-2 size-1.5`} aria-hidden="true" />
                  <span>{insight.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="review" className="section">
        <h2 id="review" className="font-heading text-[1.0625rem] leading-tight mb-1">
          Review
        </h2>
        <p className="text-[0.8125rem] text-ink-3 mb-5 max-w-[66ch]">
          Answers come back for review: a gap the next day, a partial answer after three days, a strong one after a week
          and then at growing intervals. Answer from memory; the new answer replaces the old evidence.
        </p>
        {awaitingRefs.length === 0 && due.length === 0 ? (
          <p className="text-[0.875rem] text-ink-2">
            Nothing is due.
            {upcoming[0] && (
              <>
                {" "}
                The next review is {daysUntil(upcoming[0].dueAt, now)}
                {upcoming.length > 1 ? `, with ${upcoming.length - 1} more after it` : ""}.
              </>
            )}
          </p>
        ) : (
          <>
            <ul className="panel divide-y divide-rule-soft">
              {awaitingRefs.map((ref) => {
                const l = label(ref);
                if (!l) return null;
                return (
                  <li key={exerciseKey(ref)}>
                    <Link href={l.href} className="group flex items-center justify-between gap-4 px-4 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-[0.8125rem] font-medium group-hover:text-accent">{l.title}</span>
                        <span className="block text-[0.75rem] text-ink-3">{l.source}</span>
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
                  <li key={item.key}>
                    <Link href={l.href} className="group flex items-center justify-between gap-4 px-4 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-[0.8125rem] font-medium group-hover:text-accent">{l.title}</span>
                        <span className="block text-[0.75rem] text-ink-3">
                          {l.source} · answered {daysAgo(item.answeredAt, now)}
                        </span>
                      </span>
                      <SignalBadge signal={item.signal} />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {upcoming[0] && (
              <p className="mt-3 text-xs text-ink-3">
                {upcoming.length} more scheduled; the next {daysUntil(upcoming[0].dueAt, now)}.
              </p>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="dimensions" className="section">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <h2 id="dimensions" className="font-heading text-[1.0625rem] leading-tight">
            By dimension
          </h2>
          <Legend />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Dimension</th>
                <th scope="col">Description</th>
                <th scope="col">Standing</th>
                <th scope="col">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {DIMENSIONS.map((d) => {
                const s = dimensions[d];
                const signal = STANDING_SIGNAL[s.standing];
                return (
                  <tr key={d}>
                    <th scope="row" className="pr-6">
                      <span className="block text-[0.875rem] font-medium text-ink">{DIMENSION_LABELS[d].label}</span>
                      <span className="block text-xs font-normal text-ink-3">{DIMENSION_LABELS[d].verb}</span>
                    </th>
                    <td className="max-w-[34ch] pr-6 text-[0.8125rem] leading-relaxed">
                      {DIMENSION_LABELS[d].description}
                    </td>
                    <td className="pr-6">
                      {signal ? (
                        <SignalBadge signal={signal}>{STANDING_LABEL[s.standing]}</SignalBadge>
                      ) : (
                        <span className="chip-flat">Not yet</span>
                      )}
                    </td>
                    <td className="min-w-40">
                      <SignalMeter counts={s.counts} label={DIMENSION_LABELS[d].label} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-ink-3">
          Fewer than three pieces of evidence in a dimension is indicative, not conclusive.
        </p>
      </section>

      {touched.length > 0 && (
        <section aria-labelledby="investigations" className="section">
          <h2 id="investigations" className="font-heading text-[1.0625rem] leading-tight mb-5">
            By investigation
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {touched.map((inv) => {
              const comps = byCompetency(latest, inv.id);
              const answered = [...latest.values()].filter(
                (e) => e.exercise.kind === "stage" && e.exercise.investigationId === inv.id,
              ).length;
              return (
                <div key={inv.id} className="panel p-4">
                  <div className="flex items-baseline justify-between gap-4 pb-3">
                    <Link
                      href={`/investigations/${inv.id}/review`}
                      className="font-heading text-[1rem] leading-tight hover:text-accent"
                    >
                      {inv.title}
                    </Link>
                    <span className="text-xs text-ink-3 shrink-0">
                      {answered} of {inv.stageCount} stages
                    </span>
                  </div>
                  <ul className="divide-y divide-rule-soft">
                    {inv.competencies.map((c) => {
                      const s = comps.get(c.id);
                      return (
                        <li
                          key={c.id}
                          className="grid grid-cols-[minmax(0,1fr)_10rem] items-center gap-4 py-2.5 text-sm"
                        >
                          <span title={c.description}>{c.label}</span>
                          {s ? (
                            <SignalMeter counts={s.counts} label={c.label} />
                          ) : (
                            <span className="text-xs text-ink-3">not yet exercised</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {conceptSummaries.length > 0 && (
        <section aria-labelledby="concepts" className="section">
          <h2 id="concepts" className="font-heading text-[1.0625rem] leading-tight mb-1">
            By concept
          </h2>
          <p className="text-[0.8125rem] text-ink-3 mb-5">
            Weakest first. Each concept collects evidence from every stage and check that uses it.
          </p>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Concept</th>
                  <th scope="col">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {conceptSummaries.map(({ id, title, s }) => (
                  <tr key={id}>
                    <th scope="row" className="w-1/2 pr-6">
                      <Link href={`/concepts/${id}`} className="hover:underline underline-offset-4">
                        {title}
                      </Link>
                    </th>
                    <td className="min-w-40">
                      <SignalMeter counts={s.counts} label={title} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
}
