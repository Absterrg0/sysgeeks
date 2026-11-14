"use client";

import type { ReactNode } from "react";
import { DotArrow } from "@/components/icons";
import { ReviewOverview, type ReviewScenario, type ReviewSystem } from "@/components/review/review-overview";
import { setHash, useHash } from "@/lib/client/use-hash";
import type { CuratedLabels } from "@/lib/exercise-labels";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "standing", label: "Where you stand" },
  { id: "session", label: "Mock interview" },
  { id: "claims", label: "Claim check" },
  { id: "dimension", label: "Drill a skill" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * Review as one working page with tabs, kept in the URL's #fragment so each tool has its own address. The
 * tools are rendered by the server and passed in; only the overview is built here.
 */
export function ReviewTabs({
  panels,
  systems,
  scenarios,
  conceptCount,
  exerciseCount,
  curated,
}: {
  panels: Record<Exclude<TabId, "overview">, ReactNode>;
  systems: ReviewSystem[];
  scenarios: ReviewScenario[];
  conceptCount: number;
  exerciseCount: number;
  curated: CuratedLabels;
}) {
  const hash = useHash();
  const tab: TabId = TABS.some((t) => t.id === hash) ? (hash as TabId) : "overview";
  const open = (id: string) => {
    setHash(id);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <header className="pt-10 sm:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <h1 className="text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.035em]">
              Review
            </h1>
            <p className="mt-2.5 max-w-[60ch] text-[0.9375rem] leading-relaxed text-ink-2">
              Come back to what you answered, and practise across every system.
            </p>
          </div>
          <button type="button" className="btn btn-accent group" onClick={() => open("session")}>
            Start a mock interview
            <DotArrow />
          </button>
        </div>
        <div role="tablist" aria-label="Review" className="line-tabs mt-8">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              className="line-tab"
              onClick={() => open(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <div className="mt-8">
        <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" hidden={tab !== "overview"}>
          <ReviewOverview
            systems={systems}
            scenarios={scenarios}
            conceptCount={conceptCount}
            exerciseCount={exerciseCount}
            curated={curated}
            onOpen={open}
          />
        </div>
        {(Object.keys(panels) as (keyof typeof panels)[]).map((id) => (
          <div key={id} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={tab !== id}>
            {panels[id]}
          </div>
        ))}
      </div>
    </>
  );
}
