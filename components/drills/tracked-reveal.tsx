"use client";

import { useRef, type ReactNode, type SyntheticEvent } from "react";
import { track } from "@/lib/analytics";

export function TrackedReveal({ drillId, children }: { drillId: string; children: ReactNode }) {
  const recorded = useRef(false);

  function onToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || recorded.current) return;
    recorded.current = true;
    track("quick_drill_revealed", { drill_id: drillId });
  }

  return <details onToggle={onToggle}>{children}</details>;
}
