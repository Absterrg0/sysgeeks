"use client";

import { useEffect, useRef } from "react";
import { AiKeySettingsForm } from "./ai-key-settings";

/** The key settings in a native modal. Esc and the backdrop close it. */
export function AiKeyDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="ai-key-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="dialog max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-[34rem] overflow-y-auto"
    >
      <div className="flex items-start justify-between gap-4 border-b border-rule-soft px-5 pt-4 pb-3">
        <div>
          <h2 id="ai-key-title" className="font-display text-[1.25rem] leading-tight tracking-[-0.015em]">
            Your AI key
          </h2>
          <p className="mt-1 text-small text-ink-3">AI features run on your own provider account. Everything else is free without one.</p>
        </div>
        <button type="button" className="knob size-8 shrink-0" aria-label="Close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="px-5 py-5">
        <AiKeySettingsForm onDone={onClose} />
      </div>
    </dialog>
  );
}
