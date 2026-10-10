import Link from "next/link";
import { DIFFICULTY } from "@/components/investigation/difficulty";
import { InvestigationProgress } from "@/components/investigation/progress";
import { SystemThumb } from "@/components/system-thumb";
import type { Investigation } from "@/lib/domain/content";
import { visibleAfter } from "@/lib/domain/visibility";

const LEVELS = ["foundational", "intermediate", "advanced"] as const;

/** One system as a card: the architecture's silhouette on a small display, what it is, and how far along you are. */
function SystemCard({ inv, clamp }: { inv: Investigation; clamp: boolean }) {
  const stages = inv.stages.map((s) => ({ id: s.id, title: s.title, phase: s.phase }));
  return (
    <li className="min-w-0">
      <Link href={`/investigations/${inv.id}`} className="sheet group flex h-full flex-col overflow-hidden">
        <span className="dotgrid flex h-32 items-center justify-center border-b border-rule-soft px-6 py-4" aria-hidden="true">
          <SystemThumb
            className="max-h-full"
            components={inv.system.components}
            flows={inv.system.flows}
            given={visibleAfter(inv, 0).components}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col px-4 pt-3 pb-3.5">
          <span className="block text-[0.9375rem] font-medium leading-snug text-balance transition-colors group-hover:text-accent">
            {inv.title}
          </span>
          <span className="mt-0.5 block text-[0.75rem] text-ink-3">{inv.searchTitle}</span>
          <span
            className={`mt-2 text-[0.8125rem] leading-relaxed text-ink-2 text-pretty ${clamp ? "line-clamp-3" : ""}`}
          >
            {inv.premise}
          </span>
          <span className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-3.5 text-[0.75rem]">
            <span className="text-ink-3">
              {DIFFICULTY[inv.difficulty]} · {inv.estimatedMinutes} min
            </span>
            <InvestigationProgress investigationId={inv.id} stages={stages} />
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * The investigations as a grid of cards. Grouped, they are split by level, foundational first, each level
 * under its own heading.
 */
export function InvestigationIndex({
  investigations,
  clamp = true,
  grouped = false,
}: {
  investigations: readonly Investigation[];
  /** Cut each premise to three lines, so the cards in a row end level. */
  clamp?: boolean;
  /** Split the grid by difficulty. */
  grouped?: boolean;
}) {
  const grid = (list: readonly Investigation[]) => (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((inv) => (
        <SystemCard key={inv.id} inv={inv} clamp={clamp} />
      ))}
    </ol>
  );
  if (!grouped) return grid(investigations);
  return (
    <div className="space-y-10">
      {LEVELS.map((level) => {
        const list = investigations.filter((inv) => inv.difficulty === level);
        if (list.length === 0) return null;
        return (
          <section key={level} aria-labelledby={`level-${level}`}>
            <h2 id={`level-${level}`} className="mb-3 flex items-baseline gap-2 text-[0.875rem] font-semibold">
              {DIFFICULTY[level]}
              <span className="font-mono text-[0.6875rem] font-normal text-ink-3">{list.length}</span>
            </h2>
            {grid(list)}
          </section>
        );
      })}
    </div>
  );
}
