"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ConceptStanding } from "@/components/concept-standing";
import { AppHeader } from "@/components/page-header";
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
      <AppHeader
        title="System design concepts"
        count={concepts.length}
        description="Learn core system design concepts with short lessons, interactive checks, and examples of how each mechanism fails."
        actions={
          <label className="flex h-8 w-[17rem] max-w-full items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--raised)_55%,var(--paper))] px-2.5 text-ink-3 shadow-[inset_0_0_0_1px_var(--rule-strong)] focus-within:shadow-[inset_0_0_0_1px_var(--focus)]">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="sr-only">Search concepts</span>
            <input
              ref={search}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search concepts"
              className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-ink outline-none placeholder:text-ink-3"
            />
            <span className="kbd" aria-hidden="true">
              /
            </span>
          </label>
        }
      >
        <div className="flex items-end justify-between gap-6 border-b border-rule">
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
      </AppHeader>

      <section aria-labelledby="concepts-overview" className="mt-4 rounded-xl border border-rule bg-[color-mix(in_srgb,var(--raised)_45%,var(--paper))] p-4 sm:p-5">
        <h2 id="concepts-overview" className="font-display text-[1.125rem] leading-tight tracking-[-0.015em]">
          What are system design concepts?
        </h2>
        <p className="mt-2 max-w-[78ch] text-[0.875rem] leading-relaxed text-ink-2">
          They are the mechanisms engineers combine to meet requirements for scale, speed, reliability, and correct data.
          Each choice has a cost: <Link href="/concepts/caching" className="link">caching</Link> speeds repeated reads but can
          return stale data; <Link href="/concepts/replication" className="link">replication</Link> can improve availability but
          may lag; <Link href="/concepts/message-queues" className="link">message queues</Link> absorb short bursts but build a
          backlog when work arrives faster than it can be processed. Open a concept below to examine its assumptions,
          trade-offs, and failure modes.
        </p>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <PracticeEntryLink
          href="/review#session"
          source="concept_browser_mock_interview"
          className="btn btn-accent btn-sm"
        >
          Try a timed system design mock
        </PracticeEntryLink>
        <span className="text-[0.8125rem] text-ink-3">No account needed. Your progress stays in this browser.</span>
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="sheet py-1.5">
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
              <h2 className="sheet-label flex justify-between px-5 pt-3.5 pb-1.5">
                <span>{group.label}</span>
                <span className="font-mono">{group.items.length}</span>
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
                        className={`mx-1.5 grid grid-cols-[0.5rem_minmax(0,1fr)_auto] items-center gap-3.5 rounded-lg px-3.5 py-2.5 transition-colors ${
                          on
                            ? "bg-accent-soft shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent-solid)_30%,transparent)]"
                            : "hover:bg-[color-mix(in_srgb,var(--hover)_70%,transparent)]"
                        }`}
                      >
                        <span className={`led ${lights.get(c.id) ?? "led-off"}`} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-[0.875rem] font-medium text-ink">{c.title}</span>
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
          <aside aria-label={selected.title} className="sheet sticky top-28 hidden max-h-[calc(100dvh-8rem)] overflow-y-auto p-5 lg:block">
            <span className="chip-flat">{labelOf(selected.domain)}</span>
            <h2 className="mt-3 font-display text-[1.375rem] leading-tight tracking-[-0.015em]">{selected.title}</h2>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-2">{selected.summary}</p>
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[0.8125rem]">
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
              className="btn btn-accent mt-5 w-full"
              onClick={() => track("practice_entry_clicked", { source: "concept_browser", concept: selected.id })}
            >
              {selected.checks > 0 ? "Start the lesson" : "Read it"}
            </Link>
            {selected.systems.length > 0 && (
              <>
                <p className="sheet-label mt-6 mb-1.5">
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
    </>
  );
}
