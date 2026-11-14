"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ConceptStanding } from "@/components/concept-standing";
import { DotArrow } from "@/components/icons";
import { PracticeEntryLink } from "@/components/practice-entry-link";
import { STANDING_SIGNAL } from "@/components/ui";
import { track } from "@/lib/analytics";
import { byConcept, latestEvidence } from "@/lib/domain/understanding";
import { useLearnerState } from "@/lib/store/learner-store";

export type BrowserConcept = {
  id: string;
  title: string;
  summary: string;
  domain: string;
  /** Checks in its lesson; 0 when the concept is read rather than taught step by step. */
  checks: number;
  claims: number;
  /** Systems with a stage that leans on it. */
  systems: { id: string; title: string }[];
  stages: number;
};

type Sort = "area" | "used";

const LED: Record<string, string> = { strong: "led-strong", partial: "led-partial", gap: "led-gap" };

/** Each concept's standing as a light, from the learner's latest evidence. Empty before hydration. */
function useStandingLights(): Map<string, string> {
  const state = useLearnerState();
  return useMemo(() => {
    const lights = new Map<string, string>();
    if (!state) return lights;
    for (const [id, summary] of byConcept(latestEvidence(state.attempts))) {
      const signal = STANDING_SIGNAL[summary.standing];
      if (signal && LED[signal]) lights.set(id, LED[signal]);
    }
    return lights;
  }, [state]);
}

/**
 * Every concept as one list beside a detail pane. Tabs filter by area and search narrows by words; on wide
 * screens picking a concept shows it in the pane, on narrow ones it opens the concept.
 */
export function ConceptBrowser({
  concepts,
  domains,
}: {
  concepts: BrowserConcept[];
  domains: { id: string; label: string }[];
}) {
  const [domain, setDomain] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("area");
  const mostUsed = useMemo(
    () => [...concepts].sort((a, b) => b.systems.length - a.systems.length || b.stages - a.stages)[0]?.id,
    [concepts],
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(mostUsed);
  const search = useRef<HTMLInputElement>(null);
  const lights = useStandingLights();
  const labelOf = (id: string) => domains.find((d) => d.id === id)?.label ?? id;

  // "/" jumps to the search field, as it does in most tools.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || target.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const words = query.trim().toLowerCase();
  const shown = concepts.filter(
    (c) =>
      (domain === "all" || c.domain === domain) &&
      (!words || c.title.toLowerCase().includes(words) || c.summary.toLowerCase().includes(words)),
  );
  const groups =
    sort === "used"
      ? [{ id: "used", label: "Most used first", items: [...shown].sort((a, b) => b.systems.length - a.systems.length || b.stages - a.stages) }]
      : domains
          .map((d) => ({ id: d.id, label: d.label, items: shown.filter((c) => c.domain === d.id) }))
          .filter((g) => g.items.length > 0);
  const selected = concepts.find((c) => c.id === selectedId) ?? shown[0];

  const pick = (e: MouseEvent, id: string) => {
    // Wide screens show the concept in the pane; a modified click still opens it.
    if (e.metaKey || e.ctrlKey || e.shiftKey || !window.matchMedia("(min-width: 1024px)").matches) {
      track("practice_entry_clicked", { source: "concept_browser_list", concept: id });
      return;
    }
    e.preventDefault();
    setSelectedId(id);
  };

  return (
    <>
      <header className="pt-10 sm:pt-14">
        <p className="font-mono text-[0.75rem] text-ink-3">
          {concepts.length} concepts · {domains.length} areas · short lessons with checks
        </p>
        <h1 className="mt-4 max-w-[22ch] text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          {concepts.length} system design concepts with examples.
        </h1>
        <p className="mt-3 max-w-[58ch] text-[0.9375rem] leading-relaxed text-ink-2 text-pretty">
          The mechanisms behind scalable systems: what each one buys, what it costs, and how it fails. Short lessons with
          checks that answer straight away.
        </p>
        <label className="mt-8 flex h-11 w-full max-w-[34rem] items-center gap-2.5 rounded-[12px] bg-raised px-3.5 text-ink-3 shadow-[var(--shadow-btn)] focus-within:shadow-[0_0_0_1px_var(--edge-strong),0_0_0_4px_color-mix(in_srgb,var(--ink)_8%,transparent)]">
          <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden="true">
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="sr-only">Search concepts</span>
          <input
            ref={search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search caching, quorum, backpressure…"
            className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-ink-3"
          />
          <span className="kbd" aria-hidden="true">
            /
          </span>
        </label>
        <div className="mt-6 flex items-end justify-between gap-6 border-b border-rule">
          <div role="tablist" aria-label="Area" className="line-tabs -mb-px border-0">
            {[{ id: "all", label: "All" }, ...domains].map((d) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={domain === d.id}
                className="line-tab"
                onClick={() => setDomain(d.id)}
              >
                {d.label}
                <small>{d.id === "all" ? concepts.length : concepts.filter((c) => c.domain === d.id).length}</small>
              </button>
            ))}
          </div>
          <div className="seg mb-2 hidden shrink-0 sm:flex" role="group" aria-label="Order">
            {(
              [
                ["area", "By area"],
                ["used", "Most used"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="seg-item h-6 px-2.5 text-[0.75rem]"
                aria-pressed={sort === id}
                onClick={() => setSort(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mt-6 grid items-start gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="sheet overflow-hidden pb-1.5">
          {groups.length === 0 && (
            <p className="px-5 py-10 text-center text-[0.875rem] text-ink-3">
              Nothing matches &ldquo;{query}&rdquo;.{" "}
              <button type="button" className="link" onClick={() => setQuery("")}>
                Clear the search
              </button>
            </p>
          )}
          {groups.map((group) => (
            <section key={group.id} aria-label={group.label}>
              <h2 className="flex items-baseline justify-between border-b border-rule-soft px-5 pt-4 pb-2 text-[0.75rem] font-medium text-ink-3">
                <span>{group.label}</span>
                <span className="font-mono tabular-nums">{group.items.length}</span>
              </h2>
              <ul>
                {group.items.map((c) => {
                  const on = c.id === selected?.id;
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/concepts/${c.id}`}
                        onClick={(e) => pick(e, c.id)}
                        aria-current={on ? "true" : undefined}
                        className={`relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 transition-colors ${
                          on
                            ? "bg-hover before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-ink"
                            : "hover:bg-hover"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 truncate text-[0.9375rem] font-medium tracking-[-0.01em] text-ink">
                            {lights.get(c.id) && <span className={`led ${lights.get(c.id)} shrink-0`} aria-hidden="true" />}
                            <span className="truncate">{c.title}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-3">{c.summary}</span>
                        </span>
                        <span className="hidden font-mono text-[0.6875rem] whitespace-nowrap text-ink-3 tabular-nums sm:inline">
                          {c.systems.length > 0
                            ? `${c.systems.length} system${c.systems.length === 1 ? "" : "s"}`
                            : "background"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {selected && (
          <aside aria-label={selected.title} className="sheet sticky top-24 hidden max-h-[calc(100dvh-7rem)] overflow-y-auto p-6 lg:block">
            <p className="kicker">{labelOf(selected.domain)}</p>
            <h2 className="mt-2 text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]">{selected.title}</h2>
            <p className="mt-2.5 text-[0.875rem] leading-relaxed text-ink-2">{selected.summary}</p>
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 border-y border-rule-soft py-4 text-[0.8125rem]">
              <dt className="text-ink-3">Lesson</dt>
              <dd className="text-right">{selected.checks > 0 ? `${selected.checks} checks along the way` : "Read through"}</dd>
              <dt className="text-ink-3">Claim check</dt>
              <dd className="text-right">{selected.claims > 0 ? `${selected.claims} claims` : "None"}</dd>
              <dt className="text-ink-3">Your standing</dt>
              <dd className="flex justify-end">
                <ConceptStanding conceptId={selected.id} showEmpty />
              </dd>
            </dl>
            <Link
              href={`/concepts/${selected.id}`}
              className="btn btn-accent group mt-5 w-full"
              onClick={() => track("practice_entry_clicked", { source: "concept_browser", concept: selected.id })}
            >
              {selected.checks > 0 ? "Start the lesson" : "Read it"}
              <DotArrow />
            </Link>
            {selected.systems.length > 0 && (
              <>
                <p className="kicker mt-6 mb-1.5">
                  Used in {selected.systems.length} system{selected.systems.length === 1 ? "" : "s"}
                </p>
                <ul>
                  {selected.systems.map((s) => (
                    <li key={s.id} className="border-t border-rule-soft">
                      <Link
                        href={`/investigations/${s.id}`}
                        className="group flex items-center gap-2.5 py-2 text-[0.8125rem] text-ink-2 hover:text-ink"
                      >
                        <span className="min-w-0 flex-1 truncate">{s.title}</span>
                        <span className="text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        )}
      </div>
      <div className="mt-20 max-w-[42rem] space-y-12">
        <section aria-labelledby="concepts-overview">
          <h2 id="concepts-overview" className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]">
            What are system design concepts?
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
            System design concepts are mechanisms engineers combine to meet requirements for scale, speed, reliability, and
            correct data. In an interview, choose among them and explain each cost.{" "}
            <Link href="/concepts/caching" className="link">
              Caching
            </Link>{" "}
            speeds repeated reads but can return stale data;{" "}
            <Link href="/concepts/replication" className="link">
              replication
            </Link>{" "}
            can improve availability but may lag;{" "}
            <Link href="/concepts/message-queues" className="link">
              message queues
            </Link>{" "}
            absorb short bursts but build a backlog when work arrives faster than it can be processed. Open a concept above
            to examine its assumptions, trade-offs, and failure modes.
          </p>
        </section>
        <section aria-labelledby="concepts-example">
          <h2 id="concepts-example" className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]">
            Worked example: designing a URL shortener
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
            At a modeled peak of 19,000 redirects per second, one Postgres primary can still be enough. A CDN caches
            popular links near readers, click events are recorded asynchronously, and short cache lifetimes plus explicit
            purges let the service disable a bad link. That one design uses durability, caching, asynchronous processing,
            and invalidation; each solves a different constraint and adds its own failure case.
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
            <Link href="/investigations/url-shortener" className="link">
              Read the worked URL-shortener system design
            </Link>
            . Then examine <Link href="/concepts/caching" className="link">caching</Link>,{" "}
            <Link href="/concepts/asynchronous-processing" className="link">
              asynchronous processing
            </Link>
            , and <Link href="/concepts/idempotency" className="link">idempotency</Link> in detail.
          </p>
          <PracticeEntryLink
            href="/system-design-mock-interview#start"
            source="concept_browser_mock_interview"
            className="btn btn-secondary group mt-6"
          >
            Try a timed system design mock
            <DotArrow />
          </PracticeEntryLink>
        </section>
      </div>
    </>
  );
}
