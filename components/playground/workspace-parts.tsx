"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Simulation, Workload } from "@/lib/domain/playground";
import { formatLatency, formatRate, percent } from "@/lib/domain/playground-insights";
import { scenarioKey, type Scenario, type ScenarioProgress } from "@/lib/domain/scenarios";

// ---------------------------------------------------------------------------
// Traffic: one continuous dial, on a log scale, from a quiet night to twenty times the peak.
// ---------------------------------------------------------------------------

const STEPS = 1000;
const MIN = 0.25;

export function trafficRange(workload: Workload) {
  return { min: MIN, max: Math.max(workload.peak * 20, 20) };
}

const toSlider = (traffic: number, max: number) =>
  Math.round((Math.log(traffic / MIN) / Math.log(max / MIN)) * STEPS);
const fromSlider = (value: number, max: number) => {
  const raw = MIN * Math.pow(max / MIN, value / STEPS);
  // Snap to round numbers so the readout stays legible.
  const step = raw < 2 ? 0.05 : raw < 10 ? 0.25 : raw < 50 ? 1 : 5;
  return Math.max(MIN, Math.round(raw / step) * step);
};

export function formatMultiplier(m: number) {
  return m >= 10 ? `${Math.round(m)}×` : `${Number(m.toFixed(2))}×`;
}

export function TrafficControl({
  workload,
  traffic,
  onChange,
  locked,
  pulse,
}: {
  workload: Workload;
  traffic: number;
  onChange: (traffic: number) => void;
  /** A mission fixes the traffic; the dial shows it but cannot move. */
  locked?: string;
  /** Draw the eye: the first thing to do here. */
  pulse?: boolean;
}) {
  const id = useId();
  const { max } = trafficRange(workload);
  const offered = workload.operations
    .filter((o) => !o.background)
    .reduce((sum, o) => sum + o.rps * traffic, 0);
  const marks = [
    { label: "avg", value: 1 },
    { label: `peak`, value: workload.peak },
    { label: "10× peak", value: workload.peak * 10 },
  ];
  return (
    <div className={`min-w-0 flex-1 rounded-[12px] px-3 pt-2 pb-1.5 transition-shadow ${pulse ? "pg-pulse" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="kicker">
          traffic
        </label>
        <p className="font-mono text-[0.75rem] text-ink-3 tabular-nums">
          {locked ? (
            <span className="text-ember">{locked}</span>
          ) : (
            <>
              <span className="text-ink">{formatMultiplier(traffic)}</span> avg ·{" "}
              <span className="text-ink">{formatRate(offered)}</span>
            </>
          )}
        </p>
      </div>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="range"
          min={0}
          max={STEPS}
          value={toSlider(traffic, max)}
          disabled={Boolean(locked)}
          onChange={(e) => onChange(fromSlider(Number(e.target.value), max))}
          className="pg-range w-full"
          style={{ ["--fill" as string]: `${(toSlider(traffic, max) / STEPS) * 100}%` }}
          aria-valuetext={`${formatMultiplier(traffic)} the average, ${formatRate(offered)}`}
        />
        <div className="relative mt-0.5 h-4" aria-hidden={locked ? true : undefined}>
          {marks.map((m) => (
            <button
              key={m.label}
              type="button"
              disabled={Boolean(locked)}
              onClick={() => onChange(m.value)}
              className="absolute -translate-x-1/2 font-mono text-[0.6875rem] whitespace-nowrap text-ink-3 transition-colors hover:text-ink disabled:pointer-events-none"
              style={{ left: `${(toSlider(m.value, max) / STEPS) * 100}%` }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The numbers that matter, big, in the bar: the one place to look while you drag.
// ---------------------------------------------------------------------------

export function headline(sim: Simulation) {
  const front = sim.operations.filter((o) => !o.background && o.offered > 0);
  const offered = front.reduce((s, o) => s + o.offered, 0);
  const failed = front.reduce((s, o) => s + o.failed, 0);
  const backlog = sim.operations.reduce((s, o) => s + o.backlog, 0);
  const saturated = front.some((o) => o.saturated);
  const p99 = Math.max(0, ...front.filter((o) => o.served > 0).map((o) => o.p99Ms));
  return { failing: offered > 0 ? failed / offered : 0, backlog, saturated, p99, instances: sim.instances };
}

export function Readouts({ sim, was }: { sim: Simulation; was?: Simulation }) {
  const h = headline(sim);
  const before = was ? headline(was) : undefined;
  const p99Text = h.saturated ? "timeout" : Number.isFinite(h.p99) ? formatLatency(h.p99) : "timeout";
  const p99Tone = h.saturated || !Number.isFinite(h.p99) ? "text-signal-gap" : h.p99 > 800 ? "text-signal-partial" : "";
  const cells = [
    { label: "p99", value: p99Text, tone: p99Tone, big: true },
    {
      label: "failing",
      value: h.failing > 0 && h.failing < 0.005 ? "<1%" : percent(h.failing),
      tone: h.failing >= 0.01 ? "text-signal-gap" : h.failing > 0 ? "text-signal-partial" : "",
    },
    {
      label: "backlog",
      value: h.backlog > 0 ? `+${formatRate(h.backlog)}` : "0",
      tone: h.backlog > 0 ? "text-signal-partial" : "",
    },
    {
      label: "servers",
      value: h.instances.toLocaleString("en-US"),
      tone: "",
      was: before && before.instances !== h.instances ? before.instances.toLocaleString("en-US") : undefined,
    },
  ];
  return (
    <dl className="flex shrink-0 items-stretch divide-x divide-rule" aria-live="polite" aria-atomic="false">
      {cells.map((c) => (
        <div key={c.label} className="flex min-w-[4.5rem] flex-col justify-center px-3 first:pl-1 sm:min-w-[5.25rem] sm:px-4">
          <dt className="kicker">{c.label}</dt>
          <dd
            className={`mt-1 font-mono leading-none tracking-[-0.02em] tabular-nums ${c.big ? "text-[1.5rem] sm:text-[1.75rem]" : "text-[1.125rem] sm:text-[1.25rem]"} ${c.tone}`}
          >
            {c.value}
            {c.was && <span className="ml-1.5 align-middle text-[0.6875rem] tracking-normal text-ink-3">was {c.was}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Which system: a menu of all of them, so switching is one click.
// ---------------------------------------------------------------------------

export function SystemPicker({
  current,
  systems,
}: {
  current: { id: string; title: string };
  systems: { id: string; title: string; missions: number }[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={root} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="group flex max-w-full min-w-0 items-center gap-2 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-hover"
      >
        <span className="min-w-0">
          <span className="kicker block">system</span>
          <span className="mt-1 block truncate text-[0.9375rem] leading-tight font-semibold tracking-[-0.015em]">
            {current.title}
          </span>
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="mt-3 shrink-0 text-ink-3 group-hover:text-ink">
          <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Systems"
          className="absolute top-full left-0 z-30 mt-1.5 max-h-[min(30rem,70dvh)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-[12px] bg-raised p-1.5 shadow-[var(--shadow-raised)]"
        >
          {systems.map((s) => (
            <li key={s.id} role="option" aria-selected={s.id === current.id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (s.id !== current.id) router.push(`/investigations/${s.id}/playground`);
                }}
                className={`flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left text-[0.875rem] transition-colors hover:bg-hover ${s.id === current.id ? "bg-hover font-medium" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                {s.missions > 0 && (
                  <span className="shrink-0 font-mono text-[0.6875rem] text-ink-3">
                    {s.missions} mission{s.missions === 1 ? "" : "s"}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Missions: the list, with what you have beaten.
// ---------------------------------------------------------------------------

export function MissionList({
  investigationId,
  scenarios,
  progress,
  onPick,
}: {
  investigationId: string;
  scenarios: Scenario[];
  progress: ScenarioProgress;
  onPick: (id: string) => void;
}) {
  const solved = scenarios.filter((s) => progress[scenarioKey(investigationId, s.id)]?.solvedAt).length;
  return (
    <section aria-labelledby="missions">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="missions" className="text-[0.9375rem] font-semibold tracking-[-0.015em]">
          Missions
        </h2>
        <p className="font-mono text-[0.75rem] text-ink-3">
          {solved} of {scenarios.length} beaten
        </p>
      </div>
      <p className="mt-1 text-[0.8125rem] leading-snug text-ink-3">
        A situation, a goal, the numbers checked live. Then how you would say it in an interview.
      </p>
      <ol className="mt-2">
        {scenarios.map((s, i) => {
          const done = Boolean(progress[scenarioKey(investigationId, s.id)]?.solvedAt);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s.id)}
                className="group -mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-[10px] px-2 py-2.5 text-left transition-colors hover:bg-hover"
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full font-mono text-[0.625rem] ${
                    done ? "bg-mark-strong text-on-signal" : "text-ink-3 shadow-[inset_0_0_0_1px_var(--rule-strong)]"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.875rem] leading-snug font-medium">{s.title}</span>
                  <span className="mt-0.5 block text-[0.75rem] leading-snug text-ink-3">{s.summary}</span>
                </span>
                <span aria-hidden="true" className="mt-0.5 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink">
                  →
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The first visit: three steps, each finished by doing it, not by reading it.
// ---------------------------------------------------------------------------

const TOUR_KEY = "sysgeeks:playground-tour";

export type CoachStep = { title: string; body: string; action?: { label: string; run: () => void } };

export function useTour() {
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after hydration
      setStep(window.localStorage.getItem(TOUR_KEY) === "done" ? null : 0);
    } catch {
      setStep(0);
    }
  }, []);
  const finish = useCallback(() => {
    setStep(null);
    try {
      window.localStorage.setItem(TOUR_KEY, "done");
    } catch {
      // A private window forgets; the tour shows once more next time.
    }
  }, []);
  return { step, setStep, finish };
}

export function Coach({
  index,
  total,
  step,
  onSkip,
}: {
  index: number;
  total: number;
  step: CoachStep;
  onSkip: () => void;
}) {
  return (
    <div
      role="status"
      className="pg-coach w-full rounded-[12px] bg-hover p-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="kicker flex items-center gap-2">
          <span className="led led-accent led-pulse" aria-hidden="true" />
          Step {index + 1} of {total}
        </p>
        <button type="button" onClick={onSkip} className="text-[0.75rem] font-medium text-ink-3 hover:text-ink">
          Skip
        </button>
      </div>
      <p className="mt-1.5 text-[0.9375rem] leading-snug font-semibold tracking-[-0.01em]">{step.title}</p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-2">{step.body}</p>
      {step.action && (
        <button type="button" onClick={step.action.run} className="btn btn-secondary btn-sm mt-2.5">
          {step.action.label}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs under the canvas: the detail, out of the way until wanted.
// ---------------------------------------------------------------------------

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; badge?: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" aria-label="Details" className="flex gap-5 overflow-x-auto border-b border-rule [scrollbar-width:none]">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`relative inline-flex shrink-0 items-center gap-1.5 pt-1 pb-2.5 text-[0.875rem] transition-colors ${
            active === t.id
              ? "font-medium text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-ink"
              : "text-ink-3 hover:text-ink"
          }`}
        >
          {t.label}
          {t.badge && <span className="font-mono text-[0.6875rem] text-ink-3">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}
