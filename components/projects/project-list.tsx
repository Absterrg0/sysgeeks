"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SystemThumb } from "@/components/system-thumb";
import { SignalMeter } from "@/components/ui";
import { useAccount } from "@/lib/client/account";
import { exerciseKey, type Project } from "@/lib/domain/learner";
import { autoLayout } from "@/lib/domain/layout";
import { creditCost } from "@/lib/domain/pricing";
import { projectQuestions } from "@/lib/domain/project-questions";
import { latestEvidence } from "@/lib/domain/understanding";
import { useLearnerState } from "@/lib/store/learner-store";

const SOURCE_LABEL: Record<Project["source"]["type"], string> = {
  manual: "Drawn by hand",
  description: "AI-drafted",
  repository: "From GitHub",
};

function updatedOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** A tile that starts something, drawn as a dashed slot in the grid. */
function StartTile({
  href,
  icon,
  title,
  body,
  primary = false,
  disabled = false,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  body: ReactNode;
  primary?: boolean;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <span
        className={`grid size-10 place-items-center rounded-xl ${
          primary ? "bg-accent-solid text-accent-ink shadow-[var(--shadow-accent)]" : "text-ink-2 shadow-[inset_0_0_0_1px_var(--rule-strong)]"
        }`}
      >
        {icon}
      </span>
      <span className="text-[0.875rem] font-semibold">{title}</span>
      <span className="max-w-[30ch] text-[0.8125rem] leading-snug text-ink-3">{body}</span>
    </>
  );
  const className =
    "flex h-full min-h-40 flex-col items-center justify-center gap-2.5 rounded-xl p-5 sm:min-h-52 text-center shadow-[inset_0_0_0_1px_var(--rule-strong)] [background:repeating-linear-gradient(135deg,transparent_0_10px,color-mix(in_srgb,var(--ink)_1.5%,transparent)_10px_11px)]";
  if (disabled) {
    return (
      <div aria-disabled="true" className={`${className} opacity-60`}>
        {inner}
      </div>
    );
  }
  return (
    <Link href={href} className={`${className} transition-shadow hover:shadow-[inset_0_0_0_1px_var(--ink-3)]`}>
      {inner}
    </Link>
  );
}

const PLUS = (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const BRANCH = (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="4.5" cy="4" r="1.7" />
    <circle cx="4.5" cy="12" r="1.7" />
    <circle cx="11.5" cy="6.5" r="1.7" />
    <path d="M4.5 5.7v4.6M11.5 8.2c0 2.2-2.6 2.2-5.6 3" />
  </svg>
);

/** Your systems as a gallery, with starting a new one as the first tile, then the curated examples. */
export function ProjectList({ examples }: { examples?: ReactNode }) {
  const state = useLearnerState();
  const { data } = useAccount();
  const aiOff = data?.features.ai === false;
  const importCost = `${creditCost("intake", { source: "readme" })}–${creditCost("intake", { source: "repository" })} credits`;

  const latest = state ? latestEvidence(state.attempts) : null;
  const projects = state?.projects ?? [];

  return (
    <div className="mt-6 space-y-10">
      <section aria-label="Your systems">
        {!state ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            <div className="sheet min-h-52" />
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <li>
              <StartTile
                href="/projects/new?method=blank"
                primary
                icon={PLUS}
                title="New system"
                body="Draw its parts and how they talk. Free, and saved in this browser."
              />
            </li>
            {projects.map((p) => {
              const questions = projectQuestions(p);
              const counts = { strong: 0, partial: 0, gap: 0 };
              for (const q of questions) {
                const e = latest?.get(exerciseKey({ kind: "project-question", projectId: p.id, questionId: q.id }));
                if (e) counts[e.evidence.signal]++;
              }
              const answered = counts.strong + counts.partial + counts.gap;
              const placed = autoLayout(p.components, p.flows);
              return (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`} className="sheet group flex h-full flex-col overflow-hidden">
                    <span className="dotgrid flex h-32 items-center justify-center border-b border-rule-soft px-6 py-4">
                      {p.components.length > 0 ? (
                        <SystemThumb
                          components={placed}
                          flows={p.flows}
                          given={new Set(p.components.map((c) => c.id))}
                          className="max-h-full"
                        />
                      ) : (
                        <span className="text-[0.75rem] text-ink-3">No parts drawn yet</span>
                      )}
                    </span>
                    <span className="flex flex-1 flex-col px-4 pt-3 pb-3.5">
                      <span className="truncate text-[0.875rem] font-medium group-hover:text-accent">{p.name}</span>
                      <span className="mt-0.5 truncate text-[0.75rem] text-ink-3">
                        {SOURCE_LABEL[p.source.type]} · updated {updatedOn(p.updatedAt)}
                      </span>
                      <span className="mt-auto pt-3">
                        {answered > 0 ? (
                          <SignalMeter counts={counts} label={`${p.name} answers`} />
                        ) : (
                          <span className="flex justify-between text-[0.75rem] text-ink-3">
                            <span>
                              {p.components.length} part{p.components.length === 1 ? "" : "s"}
                            </span>
                            <span>
                              {questions.length > 0 ? `${questions.length} questions waiting` : "Draw it to get questions"}
                            </span>
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            <li>
              <StartTile
                href="/projects/new"
                icon={BRANCH}
                title="Import from a README or GitHub"
                body={aiOff ? `${importCost} · AI is switched off on this site` : `AI drafts the model for you to check · ${importCost}`}
                disabled={aiOff}
              />
            </li>
            {projects.length === 0 && (
              <li className="sheet flex flex-col justify-center gap-1.5 p-5">
                <p className="text-[0.875rem] font-semibold">What you get</p>
                <p className="text-[0.8125rem] leading-relaxed text-ink-3">
                  Questions about your own system: what survives a crash, what happens when a dependency is slow, where
                  it breaks at ten times the load. Then a mock interview that ends on it.
                </p>
              </li>
            )}
          </ul>
        )}
      </section>
      {examples}
    </div>
  );
}
