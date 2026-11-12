/**
 * The learner's own AI provider key, kept in this browser and nowhere else.
 *
 * Saved to localStorage ("this browser") or sessionStorage ("this tab only"), never to the learner state,
 * so exporting progress never exports the key. Requests that use it go from the browser straight to the
 * provider; sysgeeks has no server code that could receive it.
 */
import { useSyncExternalStore } from "react";
import { type AiProvider, isProvider, MODEL_ID } from "@/lib/ai/providers";

const STORAGE_KEY = "sysgeeks.ai-key";

export type KeyLifetime = "browser" | "session";

export type AiKeySettings = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  /** browser: kept until removed. session: gone when this tab closes. */
  lifetime: KeyLifetime;
};

/** Keys are opaque tokens: printable ASCII with no spaces. Pasted whitespace is trimmed before this. */
const KEY_SHAPE = /^[\x21-\x7e]{8,512}$/;

export function isPlausibleKey(key: string): boolean {
  return KEY_SHAPE.test(key);
}

let cache: AiKeySettings | null | undefined;
const listeners = new Set<() => void>();

function storageFor(lifetime: KeyLifetime): Storage | null {
  try {
    return lifetime === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

/** Reads one storage area; anything malformed is treated as no key. */
function readFrom(lifetime: KeyLifetime): AiKeySettings | null {
  let raw: string | null = null;
  try {
    raw = storageFor(lifetime)?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { provider, apiKey, model } = value as Record<string, unknown>;
    if (!isProvider(provider) || typeof apiKey !== "string" || !isPlausibleKey(apiKey)) return null;
    if (typeof model !== "string" || !MODEL_ID.test(model)) return null;
    return { provider, apiKey, model, lifetime };
  } catch {
    return null;
  }
}

function read(): AiKeySettings | null {
  if (cache === undefined) cache = readFrom("session") ?? readFrom("browser");
  return cache;
}

function emit() {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  cache = undefined;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/** The saved key, null when there is none, or undefined during server render and hydration. */
export function useAiKey(): AiKeySettings | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

/** The saved key, read outside React (when a run starts). */
export function readAiKey(): AiKeySettings | null {
  return read();
}

/** Saves the key where the learner chose, and clears it from the other place. Returns false if storage refused. */
export function saveAiKey(settings: AiKeySettings): boolean {
  const { lifetime, ...stored } = settings;
  const target = storageFor(lifetime);
  const other = storageFor(lifetime === "browser" ? "session" : "browser");
  try {
    if (!target) return false;
    target.setItem(STORAGE_KEY, JSON.stringify(stored));
    other?.removeItem(STORAGE_KEY);
  } catch {
    return false;
  }
  cache = { ...settings };
  emit();
  return true;
}

/** Forgets the key everywhere this site kept it. */
export function removeAiKey() {
  for (const lifetime of ["browser", "session"] as const) {
    try {
      storageFor(lifetime)?.removeItem(STORAGE_KEY);
    } catch {
      // Nothing was stored there.
    }
  }
  cache = null;
  emit();
}

/** A key shown back to its owner: enough to recognise it, not enough to use it. */
export function maskKey(key: string): string {
  return key.length <= 8 ? "••••" : `${key.slice(0, Math.min(7, key.length - 4))}…${key.slice(-4)}`;
}
