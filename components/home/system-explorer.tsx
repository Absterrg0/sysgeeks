"use client";

import Link from "next/link";
import { useState } from "react";
import { SystemMap } from "@/components/system-map";
import type { ArchitectureFlow, PlacedComponent } from "@/lib/domain/content";

export type ExplorerSystem = {
  id: string;
  title: string;
  premise: string;
  meta: string;
  minutes: number;
  firstStageId: string;
  hasPlayground: boolean;
  components: PlacedComponent[];
  flows: ArchitectureFlow[];
};

/**
 * The systems as a list of names beside one running architecture. Pointing at a name brings its system up
 * on the right, live; choosing it opens the system.
 */
export function SystemExplorer({ systems }: { systems: ExplorerSystem[] }) {
  const [activeId, setActiveId] = useState(systems[0]?.id);
  const active = systems.find((s) => s.id === activeId) ?? systems[0];
  if (!active) return null;

  return (
    <div className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <ol className="border-t border-rule">
        {systems.map((s) => {
          const on = s.id === active.id;
          return (
            <li key={s.id} className="border-b border-rule-soft">
              <Link
                href={`/investigations/${s.id}`}
                onMouseEnter={() => setActiveId(s.id)}
                onFocus={() => setActiveId(s.id)}
                aria-describedby={on ? "explorer-premise" : undefined}
                className="group relative flex items-center gap-3 py-3 pr-1"
              >
                <span
                  className={`led shrink-0 transition-opacity ${on ? "led-accent" : "opacity-0"}`}
                  aria-hidden="true"
                />
                <span
                  className={`min-w-0 flex-1 truncate text-[0.9375rem] transition-colors ${
                    on ? "font-medium text-ink" : "text-ink-2 group-hover:text-ink"
                  }`}
                >
                  {s.title}
                </span>
                <span className="shrink-0 font-mono text-[0.6875rem] text-ink-3 tabular-nums">{s.minutes}m</span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="relative hidden min-w-0 lg:block">
        <div className="lg:sticky lg:top-28">
          <figure className="screen relative px-6 py-5" aria-label={`${active.title}: its architecture, running`}>
            <div key={active.id} className="rise flex h-[22rem] flex-col justify-center [&_svg]:max-h-[21rem]">
              <SystemMap
                bare
                compact
                live
                hideDetails
                label={`${active.title}: the finished architecture`}
                components={active.components}
                flows={active.flows}
              />
            </div>
          </figure>
          <div className="mt-5 grid gap-x-10 gap-y-4 px-1 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-0">
              <p className="font-display text-[1.375rem] leading-snug tracking-[-0.015em]">{active.title}</p>
              <p className="mt-1 font-mono text-[0.6875rem] text-ink-3">{active.meta}</p>
              <p
                id="explorer-premise"
                className="mt-2 line-clamp-3 max-w-[60ch] text-[0.9375rem] leading-relaxed text-ink-2"
              >
                {active.premise}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/investigations/${active.id}/${active.firstStageId}`} className="btn btn-accent btn-sm">
                Learn it
              </Link>
              {active.hasPlayground && (
                <Link href={`/investigations/${active.id}/playground`} className="btn btn-secondary btn-sm">
                  Play with it
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
