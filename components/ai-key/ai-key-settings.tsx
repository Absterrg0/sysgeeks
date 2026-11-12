"use client";

import Link from "next/link";
import { type FormEvent, useId, useState } from "react";
import { Callout, useToast } from "@/components/feedback";
import { Segmented } from "@/components/ui";
import { AI_ERROR_MESSAGES, AiFailure } from "@/lib/ai/errors";
import { checkKey } from "@/lib/ai/key-check";
import { AI_PROVIDERS, type AiProvider, defaultModel, MODEL_ID, modelLabel, PROVIDERS } from "@/lib/ai/providers";
import { track } from "@/lib/analytics";
import {
  type AiKeySettings,
  isPlausibleKey,
  type KeyLifetime,
  maskKey,
  removeAiKey,
  saveAiKey,
  useAiKey,
} from "@/lib/store/ai-key-store";

const PROVIDER_OPTIONS = AI_PROVIDERS.map((id) => ({
  value: id,
  label: id === "google" ? "Gemini" : PROVIDERS[id].label,
}));

const LIFETIMES: { value: KeyLifetime; label: string }[] = [
  { value: "browser", label: "This browser" },
  { value: "session", label: "This tab only" },
];

const CUSTOM = "__custom";

type Status =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "tested"; modelListed: boolean | null }
  | { kind: "failed"; failure: AiFailure }
  | { kind: "saved" }
  | { kind: "removed" };

/** The form behind the header's key button: provider, key, model, where to keep it, test and remove. */
export function AiKeySettingsForm({ onDone }: { onDone?: () => void }) {
  const saved = useAiKey();
  const id = useId();
  const [provider, setProvider] = useState<AiProvider>(saved?.provider ?? "anthropic");
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? "");
  const [model, setModel] = useState(saved?.model ?? defaultModel(saved?.provider ?? "anthropic"));
  const [custom, setCustom] = useState(() => (saved ? !isListed(saved.provider, saved.model) : false));
  const [lifetime, setLifetime] = useState<KeyLifetime>(saved?.lifetime ?? "browser");
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const { toast } = useToast();

  const info = PROVIDERS[provider];
  const trimmedKey = apiKey.trim();
  const trimmedModel = model.trim();
  const keyOk = isPlausibleKey(trimmedKey);
  const modelOk = MODEL_ID.test(trimmedModel);
  const settings: AiKeySettings = { provider, apiKey: trimmedKey, model: trimmedModel, lifetime };
  const unchanged =
    saved != null &&
    saved.provider === provider &&
    saved.apiKey === trimmedKey &&
    saved.model === trimmedModel &&
    saved.lifetime === lifetime;

  function changeProvider(next: AiProvider) {
    setProvider(next);
    setModel(defaultModel(next));
    setCustom(false);
    setStatus({ kind: "idle" });
    // A key belongs to one provider; keep it only if it is the saved key for the provider chosen again.
    setApiKey(saved?.provider === next ? saved.apiKey : "");
  }

  async function test() {
    setStatus({ kind: "testing" });
    try {
      const result = await checkKey(settings);
      setStatus({ kind: "tested", modelListed: result.modelListed });
    } catch (error) {
      setStatus({ kind: "failed", failure: error instanceof AiFailure ? error : new AiFailure("network") });
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!keyOk || !modelOk) return;
    if (!saveAiKey(settings)) {
      setStatus({ kind: "failed", failure: new AiFailure("ai_unavailable", { detail: "This browser refused to store the key." }) });
      return;
    }
    // Which provider, never the key or the model.
    track("ai_key_saved", { provider, lifetime });
    setStatus({ kind: "saved" });
    if (onDone) {
      toast({ message: `Saved. AI actions now run on your ${info.label} key.`, tone: "success" });
      onDone();
    }
  }

  function remove() {
    removeAiKey();
    setApiKey("");
    setStatus({ kind: "removed" });
  }

  return (
    <form className="grid gap-5" onSubmit={save}>
      <Segmented
        name={`${id}-provider`}
        legend="Provider"
        options={PROVIDER_OPTIONS}
        value={provider}
        onChange={changeProvider}
      />

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor={`${id}-key`} className="eyebrow">
            {info.label} API key
          </label>
          <a href={info.keyUrl} target="_blank" rel="noopener noreferrer" className="link text-small">
            Get a key from {info.label} ↗
          </a>
        </div>
        <div className="flex gap-2">
          <input
            id={`${id}-key`}
            className="field field-mono min-w-0 flex-1"
            type={reveal ? "text" : "password"}
            value={apiKey}
            placeholder={info.keyPlaceholder}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="off"
            aria-invalid={apiKey !== "" && !keyOk}
            onChange={(event) => {
              setApiKey(event.target.value);
              setStatus({ kind: "idle" });
            }}
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReveal((v) => !v)}>
            {reveal ? "Hide" : "Show"}
          </button>
        </div>
        {saved && saved.provider === provider && (
          <p className="mt-1.5 text-small text-ink-3">
            Saved: <span className="font-mono">{maskKey(saved.apiKey)}</span> ·{" "}
            {saved.lifetime === "session" ? "this tab only" : "this browser"}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${id}-model`} className="eyebrow mb-2 block">
          Model
        </label>
        <select
          id={`${id}-model`}
          className="field"
          value={custom ? CUSTOM : trimmedModel}
          onChange={(event) => {
            const next = event.target.value;
            setStatus({ kind: "idle" });
            if (next === CUSTOM) {
              setCustom(true);
              setModel("");
            } else {
              setCustom(false);
              setModel(next);
            }
          }}
        >
          {info.models.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label} — {option.note}
            </option>
          ))}
          <option value={CUSTOM}>Another model id…</option>
        </select>
        {custom && (
          <input
            aria-label="Model id"
            className="field field-mono mt-2"
            value={model}
            placeholder={info.models[0]?.id}
            spellCheck={false}
            autoCapitalize="off"
            aria-invalid={model !== "" && !modelOk}
            onChange={(event) => setModel(event.target.value)}
          />
        )}
      </div>

      <Segmented
        name={`${id}-lifetime`}
        legend="Keep the key in"
        options={LIFETIMES}
        value={lifetime}
        onChange={setLifetime}
      />

      <ul className="grid gap-1.5 text-small leading-relaxed text-ink-2">
        <li>
          <strong className="font-medium text-ink">You pay {info.label} directly</strong>, at their prices. SysGeeks
          charges nothing and earns nothing from your usage.
        </li>
        <li>
          <strong className="font-medium text-ink">The key stays in this browser</strong>
          {lifetime === "session" ? ", for this tab only, and is gone when you close it" : " until you remove it"}. It
          is not part of your progress export.
        </li>
        <li>
          <strong className="font-medium text-ink">Requests go straight to {info.label}</strong> from your browser.
          SysGeeks&rsquo;s servers never see the key, your text or the replies.
        </li>
        <li className="text-ink-3">
          Anyone using this browser profile can read a saved key. Set a spending limit on it, and use &ldquo;This tab
          only&rdquo; on a shared computer.{" "}
          <Link href="/ai" className="link" onClick={onDone}>
            How AI works here
          </Link>
        </li>
      </ul>

      <StatusLine status={status} provider={provider} model={trimmedModel} />

      <div className="flex flex-wrap items-center gap-2 border-t border-rule-soft pt-4">
        <button type="submit" className="btn btn-primary btn-sm" disabled={!keyOk || !modelOk || unchanged}>
          {saved ? "Save changes" : "Save key"}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!keyOk || !modelOk || status.kind === "testing"}
          onClick={test}
        >
          {status.kind === "testing" ? "Testing…" : "Test key"}
        </button>
        {saved && (
          <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={remove}>
            Remove key
          </button>
        )}
      </div>
    </form>
  );
}

function isListed(provider: AiProvider, model: string): boolean {
  return PROVIDERS[provider].models.some((m) => m.id === model);
}

function StatusLine({ status, provider, model }: { status: Status; provider: AiProvider; model: string }) {
  const label = PROVIDERS[provider].label;
  switch (status.kind) {
    case "tested":
      return (
        <p role="status" className="flex items-center gap-2 text-small text-ink-2">
          <span className="led led-strong size-1.5" aria-hidden="true" />
          {status.modelListed === false
            ? `${label} accepted the key, but doesn't list ${modelLabel(provider, model)} for it. Pick another model.`
            : `${label} accepted the key${status.modelListed ? ` and lists ${modelLabel(provider, model)}` : ""}.`}
        </p>
      );
    case "failed":
      return (
        <div role="alert">
          <Callout tone="failure" title={AI_ERROR_MESSAGES[status.failure.code]}>
            {status.failure.detail && (
              <p>
                {label} said: <q>{status.failure.detail}</q>
              </p>
            )}
            {status.failure.code === "network" && (
              <p>Check your connection, and that an extension or network filter isn&rsquo;t blocking {label}.</p>
            )}
          </Callout>
        </div>
      );
    case "saved":
      return (
        <p role="status" className="text-small text-ink-2">
          Saved. AI actions now run on your {label} key.
        </p>
      );
    case "removed":
      return (
        <p role="status" className="text-small text-ink-2">
          Removed. The key is gone from this browser.
        </p>
      );
    default:
      return null;
  }
}
