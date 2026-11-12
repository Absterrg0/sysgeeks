"use client";

import Link from "next/link";
import { useState } from "react";
import { openAiKeySettings } from "@/components/ai-key/events";
import type { AiRun, AiRunFeature } from "@/lib/domain/learner";
import { MAX_AI_RUNS } from "@/lib/domain/learner";
import { deleteAiRun, useLearnerState } from "@/lib/store/learner-store";

const FEATURE_LABEL: Record<AiRunFeature, string> = {
  intake: "Project draft",
  review: "Architecture review",
  questions: "Tailored questions",
};

function openLink(run: AiRun): { href: string; label: string } | null {
  if (run.feature === "review") return { href: `/reports/${run.id}`, label: "Open report" };
  if (run.feature === "intake") return { href: `/projects/new?run=${run.id}`, label: "Open draft" };
  if (run.projectId) return { href: `/projects/${run.projectId}`, label: "Open project" };
  return null;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** AI runs saved in this browser, newest first. They travel with the progress export. */
export function AiRunsList() {
  const state = useLearnerState();
  const [confirming, setConfirming] = useState<string | null>(null);

  if (!state) return <div className="h-16 well" aria-busy="true" />;
  const runs = [...state.aiRuns].reverse();

  return (
    <div className="space-y-3">
      <p className="text-[0.875rem] leading-relaxed text-ink-2">
        Drafts, reviews and question sets you ran on your own API key. They are kept here, in this browser, and
        included in the export above. The newest {MAX_AI_RUNS} are kept.
      </p>
      {runs.length === 0 ? (
        <p className="text-small text-ink-3">
          No AI runs yet.{" "}
          <button type="button" className="link" onClick={openAiKeySettings}>
            Add your API key
          </button>{" "}
          to draft, review or get questions about a system of your own.
        </p>
      ) : (
        <ul className="sheet overflow-hidden">
          {runs.map((run) => {
            const link = openLink(run);
            return (
              <li key={run.id} className="sheet-row flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5">
                <span className="w-24 shrink-0 font-mono text-micro text-ink-3 tabular-nums">{day(run.createdAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.875rem]">{FEATURE_LABEL[run.feature]}</span>
                  <span className="block truncate text-[0.75rem] text-ink-3">
                    {[run.title, run.model].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {confirming === run.id ? (
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-danger-solid btn-sm"
                      onClick={() => {
                        deleteAiRun(run.id);
                        setConfirming(null);
                      }}
                    >
                      Delete
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    {link && (
                      <Link href={link.href} className="link text-small">
                        {link.label}
                      </Link>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(run.id)}>
                      Delete
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
