"use client";

import { useState } from "react";
import { LiveCanvas } from "@/components/playground/live-canvas";
import type { PlayModel, Simulation } from "@/lib/domain/playground";

/** The finished design, running at average traffic: the live diagram, without the controls to change it. */
export function ReferenceCanvas({ model, sim, label }: { model: PlayModel; sim: Simulation; label: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <LiveCanvas
      model={model}
      sim={sim}
      selectedId={selected}
      onSelect={setSelected}
      label={label}
      className="rounded-none shadow-none"
    />
  );
}
