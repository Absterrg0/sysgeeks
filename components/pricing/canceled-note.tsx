"use client";

import { useSearchParams } from "next/navigation";
import { Callout } from "@/components/feedback";

/** Shown after the visitor backs out of Dodo checkout (`/?canceled=1#pricing`). */
export function CanceledNote() {
  const canceled = useSearchParams().get("canceled") === "1";
  if (!canceled) return null;
  return (
    <div className="mb-6">
      <Callout tone="note" title="Checkout cancelled">
        Nothing was charged. Pick a pack when you are ready.
      </Callout>
    </div>
  );
}
