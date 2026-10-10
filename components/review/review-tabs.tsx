"use client";

import type { ReactNode } from "react";
import { AppHeader } from "@/components/page-header";
import { ReviewOverview, type ReviewSystem } from "@/components/review/review-overview";
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
  conceptCount,
  exerciseCount,
  curated,
}: {
  panels: Record<Exclude<TabId, "overview">, ReactNode>;
  systems: ReviewSystem[];
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
      <AppHeader
        title="Review"
        description="Come back to what you answered, and practise across every system."
        actions={
          <button type="button" className="btn btn-accent btn-sm" onClick={() => open("session")}>
            Start a mock interview
          </button>
        }
      >
        <div role="tablist" aria-label="Review" className="line-tabs">
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
      </AppHeader>
      <div className="mt-6">
        <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" hidden={tab !== "overview"}>
          <ReviewOverview
            systems={systems}
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
