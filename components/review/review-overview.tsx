"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { DotArrow } from "@/components/icons";
import { SignalBadge, SignalMeter } from "@/components/ui";
import { exerciseKey, type ExerciseRef } from "@/lib/domain/learner";
import { daysAgo, daysUntil, reviewQueue } from "@/lib/domain/review";
import { DIMENSION_LABELS, DIMENSIONS } from "@/lib/domain/taxonomy";
import { awaitingAssessment, byConcept, byDimension, latestEvidence } from "@/lib/domain/understanding";
import { labelFor, type CuratedLabels } from "@/lib/exercise-labels";
import { useScenarioProgress } from "@/components/playground/scenario";
import { scenarioDueAt, scenarioKey } from "@/lib/domain/scenarios";
import { useLearnerState } from "@/lib/store/learner-store";
import { useNow } from "@/lib/use-now";

export type ReviewSystem = { id: string; title: string; stages: { id: string; title: string }[] };

/** A playground scenario, as Review lists it. */
export type ReviewScenario = { id: string; investigationId: string; title: string; summary: string; system: string };

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
      <circle cx="27" cy="27" r={r} fill="none" stroke="var(--rule)" strokeWidth="4" />
      {share > 0 && (
        <circle
          cx="27"
          cy="27"
          r={r}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="4"
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
    <span className="block h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_9%,transparent)]">
      <span className="block h-full rounded-full bg-ink" style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }} />
    </span>
  );
}

/**
 * The review dashboard: the one thing to do next, the practice tools, what is due, and on the side where you
 * stand by system and by skill.
 */
export function ReviewOverview({
  systems,
  scenarios,
  conceptCount,
  exerciseCount,
  curated,
  onOpen,
}: {
  systems: ReviewSystem[];
  scenarios: ReviewScenario[];
  conceptCount: number;
  exerciseCount: number;
  curated: CuratedLabels;
  /** Switches to one of the other tabs. */
  onOpen: (hash: string) => void;
}) {
  const state = useLearnerState();
  const now = useNow();
  const [scenarioProgress] = useScenarioProgress();
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

  const upNext = firstDue
    ? {
        href: firstDue.href,
        kicker: `${due.length} answer${due.length === 1 ? "" : "s"} due for review`,
        title: firstDue.title,
        detail: firstDue.source,
        cta: "Review",
      }
    : current && nextStage
      ? {
          href: `/investigations/${current.id}/${nextStage.id}`,
          kicker: current.answered > 0 ? "Continue where you left off" : "Up next",
          title: current.title,
          detail: `Stage ${nextIndex + 1} · ${nextStage.title}`,
          cta: current.answered > 0 ? "Continue" : "Start",
        }
      : null;
  const stats = [
    { label: "Exercises answered", value: latest.size, total: exerciseCount },
    { label: "Systems started", value: started.length, total: systems.length },
    { label: "Concepts touched", value: conceptsWithEvidence, total: conceptCount },
  ];

  return (
    <div className="space-y-10">
      {/* Where you are and the one thing to do next, in one surface. */}
      <section aria-label="Where you are" className="sheet overflow-hidden">
        {upNext && (
          <Link href={upNext.href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-hover sm:px-6 sm:py-5">
            <span className="min-w-0 flex-1">
              <span className="kicker block">{upNext.kicker}</span>
              <span className="mt-1 block truncate text-[1.0625rem] font-semibold tracking-[-0.02em]">{upNext.title}</span>
              <span className="mt-0.5 block truncate text-[0.875rem] text-ink-2">{upNext.detail}</span>
            </span>
            <span className="btn btn-accent shrink-0">
              {upNext.cta}
              <DotArrow />
            </span>
          </Link>
        )}
        <dl className={`grid grid-cols-3 sm:grid-cols-[auto_repeat(3,minmax(0,1fr))] ${upNext ? "border-t border-rule-soft" : ""}`}>
          <div className="hidden items-center px-6 py-4 sm:flex">
            <Ring value={latest.size} total={exerciseCount} />
          </div>
          {stats.map((st, i) => (
            <div key={st.label} className={`min-w-0 border-rule-soft px-4 py-4 sm:border-l sm:px-6 ${i > 0 ? "border-l" : ""}`}>
              <dt className="kicker truncate">{st.label}</dt>
              <dd className="mt-1.5 font-mono text-[1.125rem] leading-none tracking-[-0.02em] tabular-nums sm:text-[1.375rem]">
                {st.value}
                <span className="ml-1 text-[0.8125rem] tracking-normal text-ink-3">/ {st.total}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid items-start gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="practise">
            <SectionHead id="practise" title="Practise" />
            <div className="grid gap-3 sm:grid-cols-3">
              {TOOLS.map((tool) => (
                <button
                  key={tool.hash}
                  type="button"
                  onClick={() => onOpen(tool.hash)}
                  className="sheet group flex flex-col p-5 text-left sm:min-h-40"
                >
                  <span className="grid size-8 place-items-center rounded-[9px] bg-raised text-ink-2 shadow-[var(--shadow-key)] transition-colors group-hover:text-ink">
                    {tool.icon}
                  </span>
                  <span className="mt-4 text-[0.9375rem] font-semibold tracking-[-0.015em]">{tool.title}</span>
                  <span className="mt-1 text-[0.8125rem] leading-snug text-ink-2">{tool.body}</span>
                  <span className="mt-auto flex items-center justify-between pt-4 text-[0.75rem] text-ink-3">
                    {tool.meta}
                    <DotArrow className="text-ink-3 group-hover:text-ink" />
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="due">
            <SectionHead id="due" title="Due for review" count={due.length + awaiting.length} />
            {due.length + awaiting.length === 0 ? (
              <Empty
                title="Nothing is due."
                body={
                  upcoming[0]
                    ? `The next review is ${daysUntil(upcoming[0].dueAt, now)}${upcoming.length > 1 ? `, with ${upcoming.length - 1} more after it` : ""}.`
                    : "An answer comes back a day to a week after you give it, sooner when it was weak."
                }
              />
            ) : (
              <ul className="sheet overflow-hidden">
                {awaiting.map((ref) => {
                  const l = label(ref);
                  if (!l) return null;
                  return (
                    <li key={exerciseKey(ref)} className="sheet-row">
                      <Row href={l.href} title={l.title} meta={l.source} right={<span className="chip-flat">Needs your assessment</span>} />
                    </li>
                  );
                })}
                {due.map((item) => {
                  const l = label(item.exercise);
                  if (!l) return null;
                  return (
                    <li key={item.key} className="sheet-row">
                      <Row
                        href={l.href}
                        title={l.title}
                        meta={`${l.source} · answered ${daysAgo(item.answeredAt, now)}`}
                        right={<SignalBadge signal={item.signal} />}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <ScenarioReview scenarios={scenarios} progress={scenarioProgress} now={now} />
        </div>

        <aside className="space-y-10" aria-label="Where you stand">
          <section aria-labelledby="by-system">
            <SectionHead id="by-system" title="By system" aside="stages answered" />
            <ul className="sheet overflow-hidden py-1.5">
              {progress.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/investigations/${s.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_3rem_2.25rem] items-center gap-3 px-4 py-[0.4375rem] text-[0.8125rem] text-ink-2 transition-colors hover:bg-hover hover:text-ink"
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

          <section aria-labelledby="by-skill">
            <SectionHead
              id="by-skill"
              title="By skill"
              action={
                <button type="button" className="text-[0.8125rem] text-ink-3 transition-colors hover:text-ink" onClick={() => onOpen("dimension")}>
                  Drill one
                </button>
              }
            />
            <ul className="sheet space-y-0 overflow-hidden py-1.5">
              {DIMENSIONS.map((d) => (
                <li key={d} className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 px-4 py-[0.4375rem] text-[0.8125rem] text-ink-2">
                  <span title={DIMENSION_LABELS[d].description}>{DIMENSION_LABELS[d].label}</span>
                  {dimensions[d].total > 0 ? (
                    <SignalMeter counts={dimensions[d].counts} label={DIMENSION_LABELS[d].label} />
                  ) : (
                    <span className="text-[0.75rem] text-ink-3">No evidence yet</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SectionHead({
  id,
  title,
  count,
  aside,
  action,
}: {
  id: string;
  title: string;
  count?: number;
  aside?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 id={id} className="flex items-baseline gap-2 text-[1rem] font-semibold tracking-[-0.015em]">
        {title}
        {count !== undefined && <span className="font-mono text-[0.75rem] font-normal text-ink-3 tabular-nums">{count}</span>}
      </h2>
      {aside && <span className="text-[0.75rem] text-ink-3">{aside}</span>}
      {action}
    </div>
  );
}

function Row({ href, title, meta, right }: { href: string; title: string; meta: string; right: ReactNode }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-hover">
      <span className="min-w-0">
        <span className="block truncate text-[0.9375rem] font-medium tracking-[-0.01em]">{title}</span>
        <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-3">{meta}</span>
      </span>
      <span className="shrink-0">{right}</span>
    </Link>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="sheet flex items-center gap-4 px-5 py-5">
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full text-signal-strong shadow-[inset_0_0_0_1px_var(--rule-strong)]">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>
        <span className="block text-[0.9375rem] font-medium">{title}</span>
        <span className="mt-0.5 block text-[0.8125rem] text-ink-3">{body}</span>
      </span>
    </div>
  );
}

/**
 * Playground scenarios: solved ones come back to be solved again from scratch (3, 10, then 30 days later),
 * then a few not yet tried. Solving from a blank start again is what makes the fix stick.
 */
function ScenarioReview({
  scenarios,
  progress,
  now,
}: {
  scenarios: ReviewScenario[];
  progress: ReturnType<typeof useScenarioProgress>[0];
  now: number;
}) {
  if (scenarios.length === 0) return null;
  const rows = scenarios.map((s) => {
    const record = progress[scenarioKey(s.investigationId, s.id)];
    const dueAt = scenarioDueAt(record);
    return { ...s, solved: Boolean(record?.solvedAt), dueAt, due: dueAt !== undefined && dueAt.getTime() <= now };
  });
  const solved = rows.filter((r) => r.solved).length;
  const due = rows.filter((r) => r.due);
  const fresh = rows.filter((r) => !r.solved).slice(0, Math.max(0, 4 - due.length));
  const later = rows.filter((r) => r.solved && !r.due).sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
  const list = [...due, ...fresh];
  return (
    <section aria-labelledby="scenarios">
      <SectionHead id="scenarios" title="Missions" aside={`${solved} of ${rows.length} beaten`} />
      {list.length === 0 ? (
        <Empty
          title="Every mission is beaten and none is due."
          body={later[0]?.dueAt ? `${later[0].title} comes back ${daysUntil(later[0].dueAt.toISOString(), now)}.` : ""}
        />
      ) : (
        <ul className="sheet overflow-hidden">
          {list.map((r) => (
            <li key={`${r.investigationId}/${r.id}`} className="sheet-row">
              <Row
                href={`/investigations/${r.investigationId}/playground#scenario=${r.id}${r.due ? "&fresh=1" : ""}`}
                title={r.title}
                meta={`${r.system} · ${r.summary}`}
                right={
                  r.due ? (
                    <span className="chip-flat text-ember">Due: solve again</span>
                  ) : (
                    <span className="text-[0.8125rem] font-medium text-ink-3">Play</span>
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
