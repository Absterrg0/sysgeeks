"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import type { StageLink } from "@/components/investigation/progress";

type InvestigationOutline = { id: string; title: string; stages: StageLink[] };
type ContinueStripComponent = ComponentType<{ investigations: InvestigationOutline[] }>;

/** Load saved learner progress only when its section is close to the viewport. */
export function DeferredContinueStrip({ investigations }: { investigations: InvestigationOutline[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [ContinueStrip, setContinueStrip] = useState<ContinueStripComponent | null>(null);

  useEffect(() => {
    if (!root.current || investigations.length === 0) return;

    let cancelled = false;
    const load = () => {
      void import("@/components/continue-strip").then(({ ContinueStrip: Component }) => {
        if (!cancelled) setContinueStrip(() => Component);
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
      { rootMargin: "300px 0px" },
    );
    observer.observe(root.current);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [investigations.length]);

  if (ContinueStrip) return <ContinueStrip investigations={investigations} />;
  return <div ref={root} aria-hidden="true" />;
}
