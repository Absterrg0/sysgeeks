"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType } from "react";
import type { ExplorerSystem } from "@/components/home/system-explorer";

type Explorer = ComponentType<{ systems: ExplorerSystem[] }>;

/**
 * Keep the system links in the initial HTML, but wait to load the interactive maps until
 * the explorer is close to the viewport. The links remain useful if JavaScript is disabled.
 */
export function DeferredSystemExplorer({ systems }: { systems: ExplorerSystem[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [ExplorerComponent, setExplorerComponent] = useState<Explorer | null>(null);
  const first = systems[0];

  useEffect(() => {
    if (!root.current || !first) return;

    let cancelled = false;
    const load = () => {
      void import("@/components/home/system-explorer").then(({ SystemExplorer }) => {
        if (!cancelled) setExplorerComponent(() => SystemExplorer);
      });
    };

    if (!("IntersectionObserver" in window)) {
      load();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(root.current);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [first]);

  if (ExplorerComponent) return <ExplorerComponent systems={systems} />;
  if (!first) return null;

  return (
    <div ref={root} className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <ol className="border-t border-rule">
        {systems.map((system) => (
          <li key={system.id} className="border-b border-rule-soft">
            <Link href={`/investigations/${system.id}`} className="group flex items-center gap-3 py-3 pr-1">
              <span className="led shrink-0 opacity-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-ink-2 transition-colors group-hover:text-ink">
                {system.title}
              </span>
              <span className="shrink-0 font-mono text-[0.6875rem] text-ink-3 tabular-nums">{system.minutes}m</span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="relative hidden min-w-0 lg:block">
        <div className="lg:sticky lg:top-28">
          <figure
            className="screen relative px-6 py-5"
            aria-label={`${first.title}: interactive architecture preview`}
          >
            <div className="rise flex h-[22rem] flex-col items-center justify-center text-center">
              <p className="font-mono text-[0.6875rem] text-ink-3">Interactive architecture preview</p>
              <p className="mt-2 text-sm text-ink-2">The full diagram appears here</p>
            </div>
          </figure>
          <div className="mt-5 grid gap-x-10 gap-y-4 px-1 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-0">
              <p className="font-display text-[1.375rem] leading-snug tracking-[-0.015em]">{first.title}</p>
              <p className="mt-1 font-mono text-[0.6875rem] text-ink-3">{first.meta}</p>
              <p className="mt-2 line-clamp-3 max-w-[60ch] text-[0.9375rem] leading-relaxed text-ink-2">
                {first.premise}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/investigations/${first.id}/${first.firstStageId}`} className="btn btn-accent btn-sm">
                Learn it
              </Link>
              {first.hasPlayground && (
                <Link href={`/investigations/${first.id}/playground`} className="btn btn-secondary btn-sm">
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
