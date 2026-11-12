"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/feedback";
import { AI_PROVIDERS, modelLabel, PROVIDERS } from "@/lib/ai/providers";
import { useAiKey } from "@/lib/store/ai-key-store";
import { openAiKeySettings } from "./events";

/** Wraps an AI action. Without a saved key, the action is replaced by a prompt to add one. */
export function AiKeyGate({ children }: { children: ReactNode }) {
  const saved = useAiKey();
  if (saved === undefined) return <Skeleton lines={1} />;
  if (saved === null) return <AddKeyPrompt />;
  return <>{children}</>;
}

/** "Add your API key to use this", with where to get one from each provider. */
export function AddKeyPrompt() {
  return (
    <div className="panel grid gap-3 p-4 sm:flex sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-ui font-medium text-ink">Add your API key to use this</p>
        <p className="mt-1 text-small leading-relaxed text-ink-3">
          AI runs in your browser on your own key, billed by your provider. Get one from{" "}
          {AI_PROVIDERS.map((id, i) => (
            <span key={id}>
              <a href={PROVIDERS[id].keyUrl} target="_blank" rel="noopener noreferrer" className="link">
                {PROVIDERS[id].label}
              </a>
              {i < AI_PROVIDERS.length - 2 ? ", " : i === AI_PROVIDERS.length - 2 ? " or " : "."}
            </span>
          ))}
        </p>
      </div>
      <button type="button" className="btn btn-primary btn-sm shrink-0 justify-self-start" onClick={openAiKeySettings}>
        Add API key
      </button>
    </div>
  );
}

/** "Runs on Claude Sonnet 5.5 · your Anthropic key". Shown beside an AI action's button, where a price would be. */
export function AiModelTag() {
  const saved = useAiKey();
  if (!saved) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-small text-ink-3">
      <span>
        Runs on <span className="text-ink-2">{modelLabel(saved.provider, saved.model)}</span> · your{" "}
        {PROVIDERS[saved.provider].label} key
      </span>
      <button type="button" className="link" onClick={openAiKeySettings}>
        Change
      </button>
    </span>
  );
}
