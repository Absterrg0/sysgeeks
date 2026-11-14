import type { ReactNode } from "react";

/** The question of a stage, set apart: a heading that says it is your move, then the answer form. */
export function YourTurn({ phase, children }: { phase: string; children: ReactNode }) {
  return (
    <div className="scroll-mt-36" id="your-turn">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-[1.375rem] leading-[1.2] font-semibold tracking-[-0.025em]">Your turn</h2>
        <p className="flex items-center gap-2 text-[0.75rem] font-medium text-ink-3">
          <span className="led led-accent" aria-hidden="true" />
          {phase}
        </p>
      </div>
      {children}
    </div>
  );
}
