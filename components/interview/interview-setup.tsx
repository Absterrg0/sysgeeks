"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DotArrow } from "@/components/icons";
import {
  composeInterview,
  DURATIONS,
  type Duration,
  type Focus,
  type InterviewCandidate,
} from "@/lib/domain/interview";
import type { InterviewSession } from "@/lib/domain/learner";
import { projectQuestions } from "@/lib/domain/project-questions";
import { latestEvidence } from "@/lib/domain/understanding";
import { sessionUrl } from "@/lib/interview-url";
import { deleteInterview, startInterview, useLearnerState } from "@/lib/store/learner-store";
import { useHydrated } from "@/lib/use-hydrated";

const FOCUS: { value: Focus; label: string; description: string }[] = [
  {
    value: "balanced",
    label: "Balanced",
    description: "Recall, decisions, tradeoffs, failure and a defense, as a typical loop would.",
  },
  {
    value: "failure",
    label: "Failure-heavy",
    description: "More time on what breaks: crashes, duplicates, timeouts, partial failure.",
  },
  {
    value: "weakest",
    label: "My weak spots",
    description: "Weighted towards exercises and concepts where your evidence is weakest.",
  },
];

/** A large segmented control: the choices are the interaction, so they get room. */
function Choice<T extends string | number>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="kicker mb-2">{legend}</legend>
      <div className="flex w-full gap-1 rounded-[11px] bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] p-1 shadow-[inset_0_0_0_1px_var(--edge)]">
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={String(o.value)}
              className={`relative min-w-0 flex-1 cursor-pointer truncate rounded-[8px] px-1.5 py-2 text-center text-[0.8125rem] font-medium whitespace-nowrap sm:px-3 sm:text-[0.875rem] transition-[box-shadow,color,background-color] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)] ${
                checked ? "bg-raised text-ink shadow-[var(--shadow-btn)]" : "text-ink-3 hover:text-ink"
              } ${o.disabled ? "cursor-not-allowed opacity-45 hover:text-ink-3" : ""}`}
            >
              <input
                type="radio"
                name={name}
                checked={checked}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function InterviewSetup({
  candidates,
  layout = "page",
}: {
  candidates: InterviewCandidate[];
  /** "hero": the setup alone, as a landing page's main action; past sessions go under it when there are any. */
  layout?: "page" | "hero";
}) {
  const state = useLearnerState();
  const hydrated = useHydrated();
  const router = useRouter();
  const [duration, setDuration] = useState<Duration>(45);
  const [focus, setFocus] = useState<Focus>("balanced");
  const [projectChoice, setProjectChoice] = useState<string | null>(null);

  // The form is the same for everyone; only the few parts that read stored
  // progress wait for hydration, so the page itself paints from the server HTML.
  const learner = hydrated ? state : null;
  const latest = learner ? latestEvidence(learner.attempts) : null;
  const projects = learner?.projects ?? [];
  const projectId = projectChoice ?? projects[0]?.id ?? "";
  const project = projects.find((p) => p.id === projectId);
  const sessions = learner ? [...learner.interviews].sort((a, b) => b.startedAt.localeCompare(a.startedAt)) : [];
  const noEvidence = (latest?.size ?? 0) === 0;
  const focusInfo = FOCUS.find((f) => f.value === focus);

  const start = () => {
    const projectCandidates: InterviewCandidate[] = project
      ? projectQuestions(project).map((q) => ({
          key: `project:${project.id}/${q.id}`,
          ref: {
            kind: "project-question",
            projectId: project.id,
            questionId: q.id,
          },
          interactionKind: "open",
          phase: null,
          eventKind: null,
          dimensions: q.tags.dimensions,
          conceptIds: q.tags.conceptIds,
          minutes: 8,
        }))
      : [];
    const items = composeInterview({
      candidates: [...candidates, ...projectCandidates],
      duration,
      focus,
      latest: latest ?? new Map(),
      seed: crypto.randomUUID(),
    });
    const session: InterviewSession = {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      durationMinutes: duration,
      focus,
      items: items.map((i) => ({
        exercise: i.ref,
        section: i.section,
        attemptId: null,
      })),
      finishedAt: null,
    };
    startInterview(session);
    router.push(sessionUrl(session));
  };

  const setup = (
    <section aria-labelledby="setup" className="sheet overflow-hidden">
      <h2 id="setup" className="sr-only">
        Set up a session
      </h2>
      <div className="grid gap-5 p-5 sm:p-6">
        <Choice
          name="duration"
          legend="Length"
          options={DURATIONS.map((d) => ({ value: d, label: `${d} min` }))}
          value={duration}
          onChange={(v) => setDuration(v as Duration)}
        />
        <div>
          <Choice
            name="focus"
            legend="Focus"
            options={FOCUS.map((f) => ({ value: f.value, label: f.label, disabled: f.value === "weakest" && noEvidence }))}
            value={focus}
            onChange={(v) => setFocus(v as Focus)}
          />
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">
            {focusInfo?.description}
            {noEvidence && " My weak spots opens once you have answered a few exercises."}
          </p>
        </div>
        <div>
          <p className="kicker mb-2">Project to defend</p>
          {projects.length === 0 ? (
            <p className="text-[0.8125rem] leading-relaxed text-ink-2">
              The last question defends a curated design.{" "}
              <Link href="/projects" className="link">
                Describe a system you built
              </Link>{" "}
              to be asked about it instead.
            </p>
          ) : (
            <select
              className="field max-w-sm"
              aria-label="Project to defend"
              value={projectId}
              onChange={(e) => setProjectChoice(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="">No project, use a curated design</option>
            </select>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-rule-soft bg-[color-mix(in_srgb,var(--ink)_2%,transparent)] px-5 py-4 sm:px-6">
        <p className="max-w-[40ch] text-[0.8125rem] leading-snug text-ink-3">
          Answer first; references wait for the debrief. The clock is a guide, not a penalty.
        </p>
        <button type="button" className="btn btn-accent btn-lg group" onClick={start}>
          Start {duration}-minute interview
          <DotArrow />
        </button>
      </div>
    </section>
  );

  const history = (
    <section aria-labelledby="history">
      <h2 id="history" className="mb-3 flex items-baseline justify-between text-[1rem] font-semibold tracking-[-0.015em]">
        Past sessions
        {sessions.length > 0 && <span className="font-mono text-[0.75rem] font-normal text-ink-3">{sessions.length}</span>}
      </h2>
      {sessions.length === 0 ? (
        <p className="sheet px-4 py-4 text-[0.8125rem] leading-relaxed text-ink-3">
          None yet. Your sessions and their debriefs will be listed here.
        </p>
      ) : (
        <ul className="sheet overflow-hidden">
          {sessions.map((s) => {
            const answered = s.items.filter((i) => i.attemptId).length;
            const date = new Date(s.startedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            });
            return (
              <li key={s.id} className="sheet-row flex items-center justify-between gap-3 px-4 py-3">
                <Link href={sessionUrl(s)} className="group flex min-w-0 items-start gap-3">
                  <span
                    className={`led ${s.finishedAt ? "led-strong" : "led-partial"} mt-1.5 size-1.5`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-[0.875rem] font-medium group-hover:underline group-hover:decoration-rule-strong group-hover:underline-offset-4">
                      {date} · {s.durationMinutes} min · {FOCUS.find((f) => f.value === s.focus)?.label.toLowerCase()}
                    </span>
                    <span className="mt-0.5 block text-[0.75rem] text-ink-3">
                      {answered} of {s.items.length} answered · {s.finishedAt ? "debriefed" : "in progress"}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  className="text-[0.75rem] font-medium text-ink-3 hover:text-signal-gap"
                  onClick={() => deleteInterview(s.id)}
                  aria-label={`Delete session from ${date}`}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  if (layout === "hero") {
    return (
      <div className="space-y-8">
        {setup}
        {sessions.length > 0 && history}
      </div>
    );
  }
  return (
    <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {setup}
      {history}
    </div>
  );
}
